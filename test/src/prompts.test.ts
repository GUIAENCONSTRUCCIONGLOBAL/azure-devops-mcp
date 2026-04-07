// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { configurePrompts } from "../../src/prompts";

describe("configurePrompts", () => {
  let server: McpServer;

  beforeEach(() => {
    server = { prompt: jest.fn() } as unknown as McpServer;
  });

  describe("prompt registration", () => {
    it("registers prompts on the server", () => {
      configurePrompts(server);
      expect(server.prompt as jest.Mock).toHaveBeenCalled();
    });

    it("registers the listProjects prompt", () => {
      configurePrompts(server);
      const names = (server.prompt as jest.Mock).mock.calls.map(([name]) => name);
      expect(names).toContain("listProjects");
    });

    it("registers the listTeams prompt", () => {
      configurePrompts(server);
      const names = (server.prompt as jest.Mock).mock.calls.map(([name]) => name);
      expect(names).toContain("listTeams");
    });

    it("registers the getWorkItem prompt", () => {
      configurePrompts(server);
      const names = (server.prompt as jest.Mock).mock.calls.map(([name]) => name);
      expect(names).toContain("getWorkItem");
    });
  });

  describe("listProjects prompt", () => {
    it("should return a message that references the list_projects tool", () => {
      configurePrompts(server);
      const call = (server.prompt as jest.Mock).mock.calls.find(([name]) => name === "listProjects");
      if (!call) throw new Error("listProjects prompt not registered");

      const [, , , handler] = call;
      const result = handler({});

      expect(result.messages).toBeDefined();
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content.text).toContain("core_list_projects");
    });
  });

  describe("listTeams prompt", () => {
    it("should return a message that references the list_project_teams tool with the given project", () => {
      configurePrompts(server);
      const call = (server.prompt as jest.Mock).mock.calls.find(([name]) => name === "listTeams");
      if (!call) throw new Error("listTeams prompt not registered");

      const [, , , handler] = call;
      const result = handler({ project: "MyProject" });

      expect(result.messages).toBeDefined();
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content.text).toContain("core_list_project_teams");
      expect(result.messages[0].content.text).toContain("MyProject");
    });
  });

  describe("getWorkItem prompt", () => {
    it("should return a message that references the get_work_item tool with the given ID and project", () => {
      configurePrompts(server);
      const call = (server.prompt as jest.Mock).mock.calls.find(([name]) => name === "getWorkItem");
      if (!call) throw new Error("getWorkItem prompt not registered");

      const [, , , handler] = call;
      const result = handler({ id: "42", project: "TestProject" });

      expect(result.messages).toBeDefined();
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content.text).toContain("wit_get_work_item");
      expect(result.messages[0].content.text).toContain("42");
      expect(result.messages[0].content.text).toContain("TestProject");
    });
  });
});
