// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureReleaseTools } from "../../../src/tools/releases";

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("configureReleaseTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { getReleaseApi: jest.Mock };
  let mockReleaseApi: { getReleaseDefinitions: jest.Mock; getReleases: jest.Mock };

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn();
    mockReleaseApi = {
      getReleaseDefinitions: jest.fn(),
      getReleases: jest.fn(),
    };
    mockConnection = {
      getReleaseApi: jest.fn().mockResolvedValue(mockReleaseApi),
    };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
  });

  describe("tool registration", () => {
    it("registers release tools on the server", () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      expect(server.tool as jest.Mock).toHaveBeenCalled();
    });

    it("registers the correct tool names", () => {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const registeredTools = (server.tool as jest.Mock).mock.calls.map(([name]) => name);
      expect(registeredTools).toContain("release_get_definitions");
      expect(registeredTools).toContain("release_get_releases");
    });
  });

  describe("release_get_definitions tool", () => {
    function getHandler() {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "release_get_definitions");
      if (!call) throw new Error("release_get_definitions tool not registered");
      return call[3];
    }

    it("should call getReleaseDefinitions with the correct parameters and return the expected result", async () => {
      const handler = getHandler();

      const mockDefinitions = [
        { id: 1, name: "Release Pipeline 1" },
        { id: 2, name: "Release Pipeline 2" },
      ];
      mockReleaseApi.getReleaseDefinitions.mockResolvedValue(mockDefinitions);

      const params = {
        project: "proj1",
        expand: "None",
        queryOrder: "NameAscending",
        isExactNameMatch: false,
        isDeleted: false,
      };

      const result = await handler(params);

      expect(mockReleaseApi.getReleaseDefinitions).toHaveBeenCalled();
      expect(result.content[0].text).toBe(JSON.stringify(mockDefinitions, null, 2));
      expect(result.isError).toBeUndefined();
    });

    it("should pass optional parameters when provided", async () => {
      const handler = getHandler();

      mockReleaseApi.getReleaseDefinitions.mockResolvedValue([]);

      const params = {
        project: "proj1",
        searchText: "pipeline",
        expand: "Environments",
        artifactType: "Build",
        artifactSourceId: "source123",
        top: 10,
        continuationToken: "token",
        queryOrder: "NameDescending",
        path: "\\releases",
        isExactNameMatch: true,
        tagFilter: ["tag1", "tag2"],
        propertyFilters: ["prop1"],
        definitionIdFilter: ["1", "2"],
        isDeleted: false,
        searchTextContainsFolderName: true,
      };

      await handler(params);

      expect(mockReleaseApi.getReleaseDefinitions).toHaveBeenCalled();
    });

    it("should handle empty results", async () => {
      const handler = getHandler();

      mockReleaseApi.getReleaseDefinitions.mockResolvedValue([]);

      const result = await handler({
        project: "proj1",
        expand: "None",
        queryOrder: "NameAscending",
        isExactNameMatch: false,
        isDeleted: false,
      });

      expect(result.content[0].text).toBe(JSON.stringify([], null, 2));
    });
  });

  describe("release_get_releases tool", () => {
    function getHandler() {
      configureReleaseTools(server, tokenProvider, connectionProvider);
      const call = (server.tool as jest.Mock).mock.calls.find(([toolName]) => toolName === "release_get_releases");
      if (!call) throw new Error("release_get_releases tool not registered");
      return call[3];
    }

    it("should call getReleases with the correct parameters and return the expected result", async () => {
      const handler = getHandler();

      const mockReleases = [
        { id: 1, name: "Release 1", status: "Active" },
        { id: 2, name: "Release 2", status: "Active" },
      ];
      mockReleaseApi.getReleases.mockResolvedValue(mockReleases);

      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const params = {
        statusFilter: "Active",
        minCreatedTime: sevenDaysAgo,
        maxCreatedTime: now,
        queryOrder: "Ascending",
        expand: "None",
        isDeleted: false,
      };

      const result = await handler(params);

      expect(mockReleaseApi.getReleases).toHaveBeenCalled();
      expect(result.content[0].text).toBe(JSON.stringify(mockReleases, null, 2));
      expect(result.isError).toBeUndefined();
    });

    it("should pass optional parameters when provided", async () => {
      const handler = getHandler();

      mockReleaseApi.getReleases.mockResolvedValue([]);

      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const params = {
        project: "proj1",
        definitionId: 1,
        definitionEnvironmentId: 2,
        searchText: "release",
        createdBy: "user1",
        statusFilter: "Active",
        environmentStatusFilter: 1,
        minCreatedTime: sevenDaysAgo,
        maxCreatedTime: now,
        queryOrder: "Descending",
        top: 5,
        continuationToken: 100,
        expand: "Environments",
        artifactTypeId: "Build",
        sourceId: "source123",
        artifactVersionId: "version123",
        sourceBranchFilter: "main",
        isDeleted: false,
        tagFilter: ["tag1"],
        propertyFilters: ["prop1"],
        releaseIdFilter: [1, 2],
        path: "\\releases",
      };

      await handler(params);

      expect(mockReleaseApi.getReleases).toHaveBeenCalled();
    });

    it("should handle empty results", async () => {
      const handler = getHandler();

      mockReleaseApi.getReleases.mockResolvedValue([]);

      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const result = await handler({
        statusFilter: "Active",
        minCreatedTime: sevenDaysAgo,
        maxCreatedTime: now,
        queryOrder: "Ascending",
        expand: "None",
        isDeleted: false,
      });

      expect(result.content[0].text).toBe(JSON.stringify([], null, 2));
    });
  });
});
