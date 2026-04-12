// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

// Must be before other imports so ts-jest hoisting works
jest.mock("../../../src/index", () => ({ orgName: "test-org" }));

import { AccessToken } from "@azure/identity";
import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureSearchTools } from "../../../src/tools/search";

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("configureSearchTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { getGitApi: jest.Mock };
  let mockGitApi: { getItem: jest.Mock };

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn().mockResolvedValue({ token: "mock-token" });
    mockGitApi = { getItem: jest.fn() };
    mockConnection = { getGitApi: jest.fn().mockResolvedValue(mockGitApi) };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
    (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  describe("tool registration", () => {
    it("registers search tools on the server", () => {
      configureSearchTools(server, tokenProvider, connectionProvider, () => "AzureDevOps.MCP/1.0.0");
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });

    it("registers the correct tool names", () => {
      configureSearchTools(server, tokenProvider, connectionProvider, () => "AzureDevOps.MCP/1.0.0");
      const registeredTools = (server.tool as jest.Mock).mock.calls.map(([name]) => name);
      expect(registeredTools).toContain("search_code");
      expect(registeredTools).toContain("search_wiki");
      expect(registeredTools).toContain("search_workitem");
    });
  });

  describe("search_code tool", () => {
    function getHandler() {
      configureSearchTools(server, tokenProvider, connectionProvider, () => "AzureDevOps.MCP/1.0.0");
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "search_code");
      if (!call) throw new Error("search_code tool not registered");
      return call[3];
    }

    it("should perform a code search and return results with git item content", async () => {
      const handler = getHandler();

      const searchResults = {
        results: [
          {
            project: { id: "proj-id" },
            repository: { id: "repo-id" },
            path: "/src/main.ts",
            versions: [{ changeId: "commit-abc" }],
          },
        ],
      };
      const mockGitItem = { id: "item-1", content: "file content" };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify(searchResults)),
      } as unknown as Response);

      mockGitApi.getItem.mockResolvedValue(mockGitItem);

      const result = await handler({
        searchText: "function main",
        includeFacets: false,
        skip: 0,
        top: 5,
      });

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("almsearch.dev.azure.com/test-org/_apis/search/codesearchresults"), expect.objectContaining({ method: "POST" }));
      expect(result.content[0].text).toContain('"results"');
    });

    it("should apply project and repository filters when provided", async () => {
      const handler = getHandler();

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ results: [] })),
      } as unknown as Response);

      await handler({
        searchText: "myFunction",
        project: ["proj1", "proj2"],
        repository: ["repo1"],
        path: ["/src"],
        branch: ["main"],
        includeFacets: true,
        skip: 10,
        top: 20,
      });

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]!.body as string);
      expect(requestBody.filters.Project).toEqual(["proj1", "proj2"]);
      expect(requestBody.filters.Repository).toEqual(["repo1"]);
      expect(requestBody.filters.Path).toEqual(["/src"]);
      expect(requestBody.filters.Branch).toEqual(["main"]);
      expect(requestBody.includeFacets).toBe(true);
      expect(requestBody.$skip).toBe(10);
      expect(requestBody.$top).toBe(20);
    });

    it("should not include filters in request when no filter arrays are provided", async () => {
      const handler = getHandler();

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({ results: [] })),
      } as unknown as Response);

      await handler({
        searchText: "test",
        includeFacets: false,
        skip: 0,
        top: 5,
      });

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]!.body as string);
      expect(requestBody.filters).toBeUndefined();
    });

    it("should throw an error when the API response is not ok", async () => {
      const handler = getHandler();

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      } as unknown as Response);

      await expect(
        handler({
          searchText: "test",
          includeFacets: false,
          skip: 0,
          top: 5,
        })
      ).rejects.toThrow("Azure DevOps Code Search API error: 403 Forbidden");
    });

    it("should include error in combined results when git item fetch fails", async () => {
      const handler = getHandler();

      const searchResults = {
        results: [
          {
            project: { id: "proj-id" },
            repository: { id: "repo-id" },
            path: "/src/main.ts",
            versions: [{ changeId: "commit-abc" }],
          },
        ],
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify(searchResults)),
      } as unknown as Response);

      mockGitApi.getItem.mockRejectedValue(new Error("Git item not found"));

      const result = await handler({
        searchText: "test",
        includeFacets: false,
        skip: 0,
        top: 5,
      });

      expect(result.content[0].text).toContain("Git item not found");
    });

    it("should handle search results with missing fields in combined results", async () => {
      const handler = getHandler();

      const searchResults = {
        results: [
          {
            // Missing project, repository, path, versions
          },
        ],
      };

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify(searchResults)),
      } as unknown as Response);

      const result = await handler({
        searchText: "test",
        includeFacets: false,
        skip: 0,
        top: 5,
      });

      expect(result.content[0].text).toContain("Missing projectId");
    });

    it("should handle response with no results field (results is undefined)", async () => {
      const handler = getHandler();

      const searchResults = {}; // No results field

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify(searchResults)),
      } as unknown as Response);

      const result = await handler({
        searchText: "test",
        includeFacets: false,
        skip: 0,
        top: 5,
      });

      // Should return the response text concatenated with empty combined results
      expect(result.content[0].text).toContain("[]");
    });
  });

  describe("search_wiki tool", () => {
    function getHandler() {
      configureSearchTools(server, tokenProvider, connectionProvider, () => "AzureDevOps.MCP/1.0.0");
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "search_wiki");
      if (!call) throw new Error("search_wiki tool not registered");
      return call[3];
    }

    it("should perform a wiki search and return results", async () => {
      const handler = getHandler();

      const mockResults = JSON.stringify({ results: [{ wikiIdentifier: "wiki1", path: "/Home" }] });

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(mockResults),
      } as unknown as Response);

      const result = await handler({
        searchText: "getting started",
        includeFacets: false,
        skip: 0,
        top: 10,
      });

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("almsearch.dev.azure.com/test-org/_apis/search/wikisearchresults"), expect.objectContaining({ method: "POST" }));
      expect(result.content[0].text).toBe(mockResults);
    });

    it("should apply project and wiki filters when provided", async () => {
      const handler = getHandler();

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue("{}"),
      } as unknown as Response);

      await handler({
        searchText: "docs",
        project: ["proj1"],
        wiki: ["wiki1"],
        includeFacets: false,
        skip: 0,
        top: 10,
      });

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]!.body as string);
      expect(requestBody.filters.Project).toEqual(["proj1"]);
      expect(requestBody.filters.Wiki).toEqual(["wiki1"]);
    });

    it("should not include filters when empty arrays are provided", async () => {
      const handler = getHandler();

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue("{}"),
      } as unknown as Response);

      await handler({
        searchText: "docs",
        project: [],
        wiki: [],
        includeFacets: false,
        skip: 0,
        top: 10,
      });

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]!.body as string);
      expect(requestBody.filters).toBeUndefined();
    });

    it("should throw an error when the API response is not ok", async () => {
      const handler = getHandler();

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      } as unknown as Response);

      await expect(
        handler({
          searchText: "test",
          includeFacets: false,
          skip: 0,
          top: 10,
        })
      ).rejects.toThrow("Azure DevOps Wiki Search API error: 401 Unauthorized");
    });
  });

  describe("search_workitem tool", () => {
    function getHandler() {
      configureSearchTools(server, tokenProvider, connectionProvider, () => "AzureDevOps.MCP/1.0.0");
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "search_workitem");
      if (!call) throw new Error("search_workitem tool not registered");
      return call[3];
    }

    it("should perform a work item search and return results", async () => {
      const handler = getHandler();

      const mockResults = JSON.stringify({ results: [{ id: 1, title: "Fix bug" }] });

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(mockResults),
      } as unknown as Response);

      const result = await handler({
        searchText: "Fix bug",
        includeFacets: false,
        skip: 0,
        top: 10,
      });

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("almsearch.dev.azure.com/test-org/_apis/search/workitemsearchresults"), expect.objectContaining({ method: "POST" }));
      expect(result.content[0].text).toBe(mockResults);
    });

    it("should apply all available filters when provided", async () => {
      const handler = getHandler();

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue("{}"),
      } as unknown as Response);

      await handler({
        searchText: "login bug",
        project: ["proj1"],
        areaPath: ["proj1\\Team A"],
        workItemType: ["Bug"],
        state: ["Active"],
        assignedTo: ["user@example.com"],
        includeFacets: true,
        skip: 5,
        top: 20,
      });

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]!.body as string);
      expect(requestBody.filters["System.TeamProject"]).toEqual(["proj1"]);
      expect(requestBody.filters["System.AreaPath"]).toEqual(["proj1\\Team A"]);
      expect(requestBody.filters["System.WorkItemType"]).toEqual(["Bug"]);
      expect(requestBody.filters["System.State"]).toEqual(["Active"]);
      expect(requestBody.filters["System.AssignedTo"]).toEqual(["user@example.com"]);
      expect(requestBody.includeFacets).toBe(true);
    });

    it("should not include filters when no filter arrays are provided", async () => {
      const handler = getHandler();

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue("{}"),
      } as unknown as Response);

      await handler({
        searchText: "test",
        includeFacets: false,
        skip: 0,
        top: 10,
      });

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1]!.body as string);
      expect(requestBody.filters).toBeUndefined();
    });

    it("should throw an error when the API response is not ok", async () => {
      const handler = getHandler();

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as unknown as Response);

      await expect(
        handler({
          searchText: "test",
          includeFacets: false,
          skip: 0,
          top: 10,
        })
      ).rejects.toThrow("Azure DevOps Work Item Search API error: 500 Internal Server Error");
    });

    it("should pass the User-Agent header from the userAgentProvider", async () => {
      configureSearchTools(server, tokenProvider, connectionProvider, () => "AzureDevOps.MCP/2.0.0 TestClient/1.0");
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "search_workitem");
      if (!call) throw new Error("search_workitem tool not registered");
      const handler = call[3];

      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue("{}"),
      } as unknown as Response);

      await handler({
        searchText: "test",
        includeFacets: false,
        skip: 0,
        top: 10,
      });

      const fetchCall = (global.fetch as jest.MockedFunction<typeof fetch>).mock.calls[0];
      expect((fetchCall[1]!.headers as Record<string, string>)["User-Agent"]).toBe("AzureDevOps.MCP/2.0.0 TestClient/1.0");
    });
  });
});
