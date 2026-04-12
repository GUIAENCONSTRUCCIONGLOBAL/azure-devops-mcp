// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { describe, expect, it, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebApi } from "azure-devops-node-api";
import { configureRepoTools } from "../../../src/tools/repos";

// Mock getCurrentUserDetails used inside repo tools
jest.mock("../../../src/tools/auth", () => ({
  getCurrentUserDetails: jest.fn(),
}));

import { getCurrentUserDetails } from "../../../src/tools/auth";

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("configureRepoTools", () => {
  let server: McpServer;
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { getGitApi: jest.Mock };
  let mockGitApi: {
    getRepositories: jest.Mock;
    createPullRequest: jest.Mock;
    updatePullRequest: jest.Mock;
    createPullRequestReviewers: jest.Mock;
    deletePullRequestReviewer: jest.Mock;
    getPullRequests: jest.Mock;
    getPullRequestsByProject: jest.Mock;
    getThreads: jest.Mock;
    getComments: jest.Mock;
    getRefs: jest.Mock;
    getPullRequest: jest.Mock;
    createComment: jest.Mock;
    createThread: jest.Mock;
    updateThread: jest.Mock;
    getCommits: jest.Mock;
    getPullRequestQuery: jest.Mock;
  };

  beforeEach(() => {
    server = { tool: jest.fn() } as unknown as McpServer;
    tokenProvider = jest.fn().mockResolvedValue({ token: "mock-token" });
    mockGitApi = {
      getRepositories: jest.fn(),
      createPullRequest: jest.fn(),
      updatePullRequest: jest.fn(),
      createPullRequestReviewers: jest.fn(),
      deletePullRequestReviewer: jest.fn(),
      getPullRequests: jest.fn(),
      getPullRequestsByProject: jest.fn(),
      getThreads: jest.fn(),
      getComments: jest.fn(),
      getRefs: jest.fn(),
      getPullRequest: jest.fn(),
      createComment: jest.fn(),
      createThread: jest.fn(),
      updateThread: jest.fn(),
      getCommits: jest.fn(),
      getPullRequestQuery: jest.fn(),
    };
    mockConnection = { getGitApi: jest.fn().mockResolvedValue(mockGitApi) };
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
    (getCurrentUserDetails as jest.Mock).mockReset();
  });

  describe("tool registration", () => {
    it("registers all repo tools on the server", () => {
      configureRepoTools(server, tokenProvider, connectionProvider);
      const registeredTools = (server.tool as jest.Mock).mock.calls.map(([name]) => name);
      expect(registeredTools).toContain("repo_create_pull_request");
      expect(registeredTools).toContain("repo_list_repos_by_project");
      expect(registeredTools).toContain("repo_list_pull_requests_by_repo");
      expect(registeredTools).toContain("repo_list_pull_requests_by_project");
      expect(registeredTools).toContain("repo_get_repo_by_name_or_id");
      expect(registeredTools).toContain("repo_get_branch_by_name");
      expect(registeredTools).toContain("repo_get_pull_request_by_id");
      expect(registeredTools).toContain("repo_list_branches_by_repo");
      expect(registeredTools).toContain("repo_list_my_branches_by_repo");
      expect(registeredTools).toContain("repo_list_pull_request_threads");
      expect(registeredTools).toContain("repo_list_pull_request_thread_comments");
      expect(registeredTools).toContain("repo_reply_to_comment");
      expect(registeredTools).toContain("repo_create_pull_request_thread");
      expect(registeredTools).toContain("repo_resolve_comment");
      expect(registeredTools).toContain("repo_search_commits");
      expect(registeredTools).toContain("repo_list_pull_requests_by_commits");
      expect(registeredTools).toContain("repo_update_pull_request_status");
      expect(registeredTools).toContain("repo_update_pull_request_reviewers");
    });
  });

  function getHandler(toolName: string) {
    configureRepoTools(server, tokenProvider, connectionProvider);
    const call = (server.tool as jest.Mock).mock.calls.find(([name]) => name === toolName);
    if (!call) throw new Error(`${toolName} tool not registered`);
    return call[3];
  }

  describe("repo_create_pull_request tool", () => {
    it("should create a pull request and return the result", async () => {
      const handler = getHandler("repo_create_pull_request");
      const mockPR = { pullRequestId: 1, title: "My PR" };
      mockGitApi.createPullRequest.mockResolvedValue(mockPR);

      const result = await handler({
        repositoryId: "repo1",
        sourceRefName: "refs/heads/feature",
        targetRefName: "refs/heads/main",
        title: "My PR",
        isDraft: false,
      });

      expect(mockGitApi.createPullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceRefName: "refs/heads/feature",
          targetRefName: "refs/heads/main",
          title: "My PR",
          isDraft: false,
          workItemRefs: [],
        }),
        "repo1"
      );
      expect(result.content[0].text).toBe(JSON.stringify(mockPR, null, 2));
    });

    it("should parse workItems string into refs", async () => {
      const handler = getHandler("repo_create_pull_request");
      mockGitApi.createPullRequest.mockResolvedValue({});

      await handler({
        repositoryId: "repo1",
        sourceRefName: "refs/heads/feature",
        targetRefName: "refs/heads/main",
        title: "My PR",
        isDraft: false,
        workItems: "123 456",
      });

      expect(mockGitApi.createPullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          workItemRefs: [{ id: "123" }, { id: "456" }],
        }),
        "repo1"
      );
    });
  });

  describe("repo_update_pull_request_status tool", () => {
    it("should update status to Active", async () => {
      const handler = getHandler("repo_update_pull_request_status");
      const mockPR = { pullRequestId: 1, status: 1 };
      mockGitApi.updatePullRequest.mockResolvedValue(mockPR);

      const result = await handler({ repositoryId: "repo1", pullRequestId: 1, status: "Active" });

      expect(mockGitApi.updatePullRequest).toHaveBeenCalledWith({ status: 1 }, "repo1", 1);
      expect(result.content[0].text).toBe(JSON.stringify(mockPR, null, 2));
    });

    it("should update status to Abandoned", async () => {
      const handler = getHandler("repo_update_pull_request_status");
      mockGitApi.updatePullRequest.mockResolvedValue({ pullRequestId: 1, status: 2 });

      await handler({ repositoryId: "repo1", pullRequestId: 1, status: "Abandoned" });

      expect(mockGitApi.updatePullRequest).toHaveBeenCalledWith({ status: 2 }, "repo1", 1);
    });
  });

  describe("repo_update_pull_request_reviewers tool", () => {
    it("should add reviewers", async () => {
      const handler = getHandler("repo_update_pull_request_reviewers");
      const mockReviewers = [{ id: "rev1" }];
      mockGitApi.createPullRequestReviewers.mockResolvedValue(mockReviewers);

      const result = await handler({ repositoryId: "repo1", pullRequestId: 1, reviewerIds: ["rev1"], action: "add" });

      expect(mockGitApi.createPullRequestReviewers).toHaveBeenCalledWith([{ id: "rev1" }], "repo1", 1);
      expect(result.content[0].text).toBe(JSON.stringify(mockReviewers, null, 2));
    });

    it("should remove reviewers", async () => {
      const handler = getHandler("repo_update_pull_request_reviewers");
      mockGitApi.deletePullRequestReviewer.mockResolvedValue(undefined);

      const result = await handler({ repositoryId: "repo1", pullRequestId: 2, reviewerIds: ["rev1", "rev2"], action: "remove" });

      expect(mockGitApi.deletePullRequestReviewer).toHaveBeenCalledTimes(2);
      expect(result.content[0].text).toContain("rev1, rev2");
    });
  });

  describe("repo_list_repos_by_project tool", () => {
    it("should return a trimmed, sorted list of repositories", async () => {
      const handler = getHandler("repo_list_repos_by_project");
      mockGitApi.getRepositories.mockResolvedValue([
        { id: "r2", name: "Zeta Repo", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url2", size: 200 },
        { id: "r1", name: "Alpha Repo", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url1", size: 100 },
      ]);

      const result = await handler({ project: "proj1", top: 100, skip: 0 });

      const repos = JSON.parse(result.content[0].text);
      expect(repos[0].name).toBe("Alpha Repo");
      expect(repos[1].name).toBe("Zeta Repo");
      expect(repos[0]).not.toHaveProperty("defaultBranch");
    });

    it("should handle null response from getRepositories", async () => {
      const handler = getHandler("repo_list_repos_by_project");
      mockGitApi.getRepositories.mockResolvedValue(null);

      const result = await handler({ project: "proj1", top: 100, skip: 0 });

      // When API returns null, the optional chaining results in undefined JSON
      expect(result.content[0].text).toBeUndefined();
    });

    it("should filter repositories by name when repoNameFilter is provided", async () => {
      const handler = getHandler("repo_list_repos_by_project");
      mockGitApi.getRepositories.mockResolvedValue([
        { id: "r1", name: "my-service", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url1", size: 100 },
        { id: "r2", name: "other-repo", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url2", size: 200 },
      ]);

      const result = await handler({ project: "proj1", top: 100, skip: 0, repoNameFilter: "my" });

      const repos = JSON.parse(result.content[0].text);
      expect(repos).toHaveLength(1);
      expect(repos[0].name).toBe("my-service");
    });

    it("should paginate results", async () => {
      const handler = getHandler("repo_list_repos_by_project");
      mockGitApi.getRepositories.mockResolvedValue([
        { id: "r1", name: "Repo A", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url1", size: 100 },
        { id: "r2", name: "Repo B", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url2", size: 200 },
        { id: "r3", name: "Repo C", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url3", size: 300 },
      ]);

      const result = await handler({ project: "proj1", top: 2, skip: 1 });

      const repos = JSON.parse(result.content[0].text);
      expect(repos).toHaveLength(2);
      expect(repos[0].name).toBe("Repo B");
    });

    it("should handle repositories with undefined names in sort (fallback to 0)", async () => {
      const handler = getHandler("repo_list_repos_by_project");
      mockGitApi.getRepositories.mockResolvedValue([
        { id: "r1", name: undefined, isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url1", size: 100 },
        { id: "r2", name: "Zeta Repo", isDisabled: false, isFork: false, isInMaintenance: false, webUrl: "url2", size: 200 },
      ]);

      const result = await handler({ project: "proj1", top: 100, skip: 0 });

      const repos = JSON.parse(result.content[0].text);
      expect(repos).toHaveLength(2);
    });
  });

  describe("repo_list_pull_requests_by_repo tool", () => {
    it("should return filtered pull request list", async () => {
      const handler = getHandler("repo_list_pull_requests_by_repo");
      const mockPRs = [{ pullRequestId: 1, title: "PR 1", status: 1, createdBy: { displayName: "User", uniqueName: "user@test.com" }, creationDate: "2024-01-01", isDraft: false }];
      mockGitApi.getPullRequests.mockResolvedValue(mockPRs);

      const result = await handler({ repositoryId: "repo1", top: 100, skip: 0, created_by_me: false, i_am_reviewer: false, status: "Active" });

      expect(mockGitApi.getPullRequests).toHaveBeenCalled();
      const prs = JSON.parse(result.content[0].text);
      expect(prs[0].pullRequestId).toBe(1);
      expect(prs[0]).not.toHaveProperty("description");
    });

    it("should handle Abandoned status", async () => {
      const handler = getHandler("repo_list_pull_requests_by_repo");
      mockGitApi.getPullRequests.mockResolvedValue([]);

      await handler({ repositoryId: "repo1", top: 100, skip: 0, created_by_me: false, i_am_reviewer: false, status: "Abandoned" });

      const callArg = mockGitApi.getPullRequests.mock.calls[0][1];
      expect(callArg.status).toBe(2); // PullRequestStatus.Abandoned
    });

    it("should handle All status", async () => {
      const handler = getHandler("repo_list_pull_requests_by_repo");
      mockGitApi.getPullRequests.mockResolvedValue([]);

      await handler({ repositoryId: "repo1", top: 100, skip: 0, created_by_me: false, i_am_reviewer: false, status: "All" });

      const callArg = mockGitApi.getPullRequests.mock.calls[0][1];
      expect(callArg.status).toBe(4); // PullRequestStatus.All
    });

    it("should handle Completed status", async () => {
      const handler = getHandler("repo_list_pull_requests_by_repo");
      mockGitApi.getPullRequests.mockResolvedValue([]);

      await handler({ repositoryId: "repo1", top: 100, skip: 0, created_by_me: false, i_am_reviewer: false, status: "Completed" });

      const callArg = mockGitApi.getPullRequests.mock.calls[0][1];
      expect(callArg.status).toBe(3); // PullRequestStatus.Completed
    });

    it("should handle NotSet status", async () => {
      const handler = getHandler("repo_list_pull_requests_by_repo");
      mockGitApi.getPullRequests.mockResolvedValue([]);

      await handler({ repositoryId: "repo1", top: 100, skip: 0, created_by_me: false, i_am_reviewer: false, status: "NotSet" });

      const callArg = mockGitApi.getPullRequests.mock.calls[0][1];
      expect(callArg.status).toBe(0); // PullRequestStatus.NotSet
    });

    it("should throw for unknown status", async () => {
      const handler = getHandler("repo_list_pull_requests_by_repo");
      mockGitApi.getPullRequests.mockResolvedValue([]);

      await expect(
        handler({ repositoryId: "repo1", top: 100, skip: 0, created_by_me: false, i_am_reviewer: false, status: "UnknownStatus" })
      ).rejects.toThrow("Unknown pull request status: UnknownStatus");
    });

    it("should fetch current user when created_by_me is true", async () => {
      const handler = getHandler("repo_list_pull_requests_by_repo");
      (getCurrentUserDetails as jest.Mock).mockResolvedValue({ authenticatedUser: { id: "user-123" } });
      mockGitApi.getPullRequests.mockResolvedValue([]);

      await handler({ repositoryId: "repo1", top: 100, skip: 0, created_by_me: true, i_am_reviewer: false, status: "Active" });

      expect(getCurrentUserDetails).toHaveBeenCalled();
      const callArg = mockGitApi.getPullRequests.mock.calls[0][1];
      expect(callArg.creatorId).toBe("user-123");
    });

    it("should fetch current user when i_am_reviewer is true", async () => {
      const handler = getHandler("repo_list_pull_requests_by_repo");
      (getCurrentUserDetails as jest.Mock).mockResolvedValue({ authenticatedUser: { id: "user-456" } });
      mockGitApi.getPullRequests.mockResolvedValue([]);

      await handler({ repositoryId: "repo1", top: 100, skip: 0, created_by_me: false, i_am_reviewer: true, status: "Active" });

      expect(getCurrentUserDetails).toHaveBeenCalled();
      const callArg = mockGitApi.getPullRequests.mock.calls[0][1];
      expect(callArg.reviewerId).toBe("user-456");
    });
  });

  describe("repo_list_pull_requests_by_project tool", () => {
    it("should return pull requests for a project", async () => {
      const handler = getHandler("repo_list_pull_requests_by_project");
      const mockPRs = [
        {
          pullRequestId: 1,
          title: "PR 1",
          status: 1,
          repository: { name: "my-repo" },
          createdBy: { displayName: "User", uniqueName: "user@test.com" },
          creationDate: "2024-01-01",
          isDraft: false,
        },
      ];
      mockGitApi.getPullRequestsByProject.mockResolvedValue(mockPRs);

      const result = await handler({ project: "proj1", top: 100, skip: 0, created_by_me: false, i_am_reviewer: false, status: "Active" });

      const prs = JSON.parse(result.content[0].text);
      expect(prs[0].repository).toBe("my-repo");
    });

    it("should set creatorId when only created_by_me is true", async () => {
      const handler = getHandler("repo_list_pull_requests_by_project");
      (getCurrentUserDetails as jest.Mock).mockResolvedValue({ authenticatedUser: { id: "user-creator" } });
      mockGitApi.getPullRequestsByProject.mockResolvedValue([]);

      await handler({ project: "proj1", top: 100, skip: 0, created_by_me: true, i_am_reviewer: false, status: "Active" });

      const callArg = mockGitApi.getPullRequestsByProject.mock.calls[0][1];
      expect(callArg.creatorId).toBe("user-creator");
      expect(callArg.reviewerId).toBeUndefined();
    });

    it("should set reviewerId when only i_am_reviewer is true", async () => {
      const handler = getHandler("repo_list_pull_requests_by_project");
      (getCurrentUserDetails as jest.Mock).mockResolvedValue({ authenticatedUser: { id: "user-reviewer" } });
      mockGitApi.getPullRequestsByProject.mockResolvedValue([]);

      await handler({ project: "proj1", top: 100, skip: 0, created_by_me: false, i_am_reviewer: true, status: "Active" });

      const callArg = mockGitApi.getPullRequestsByProject.mock.calls[0][1];
      expect(callArg.reviewerId).toBe("user-reviewer");
      expect(callArg.creatorId).toBeUndefined();
    });

    it("should set creatorId and reviewerId when both flags are true", async () => {
      const handler = getHandler("repo_list_pull_requests_by_project");
      (getCurrentUserDetails as jest.Mock).mockResolvedValue({ authenticatedUser: { id: "user-789" } });
      mockGitApi.getPullRequestsByProject.mockResolvedValue([]);

      await handler({ project: "proj1", top: 100, skip: 0, created_by_me: true, i_am_reviewer: true, status: "Active" });

      const callArg = mockGitApi.getPullRequestsByProject.mock.calls[0][1];
      expect(callArg.creatorId).toBe("user-789");
      expect(callArg.reviewerId).toBe("user-789");
    });
  });

  describe("repo_list_pull_request_threads tool", () => {
    it("should return trimmed thread data by default", async () => {
      const handler = getHandler("repo_list_pull_request_threads");
      const mockThreads = [
        {
          id: 1,
          publishedDate: "2024-01-01",
          lastUpdatedDate: "2024-01-02",
          status: 1,
          comments: [
            { id: 1, isDeleted: false, author: { displayName: "User", uniqueName: "user@test.com" }, content: "Hello", publishedDate: "2024-01-01", lastUpdatedDate: "2024-01-01", lastContentUpdatedDate: "2024-01-01" },
            { id: 2, isDeleted: true, author: { displayName: "User2" }, content: "Deleted", publishedDate: "2024-01-01", lastUpdatedDate: "2024-01-01", lastContentUpdatedDate: "2024-01-01" },
          ],
        },
      ];
      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const result = await handler({ repositoryId: "repo1", pullRequestId: 1, top: 100, skip: 0, fullResponse: false });

      const threads = JSON.parse(result.content[0].text);
      expect(threads[0].id).toBe(1);
      expect(threads[0].comments).toHaveLength(1);
      expect(threads[0].comments[0].content).toBe("Hello");
    });

    it("should return full response when fullResponse is true", async () => {
      const handler = getHandler("repo_list_pull_request_threads");
      const mockThreads = [{ id: 1, publishedDate: "2024-01-01", lastUpdatedDate: "2024-01-02", status: 1, comments: [], extraField: "included" }];
      mockGitApi.getThreads.mockResolvedValue(mockThreads);

      const result = await handler({ repositoryId: "repo1", pullRequestId: 1, top: 100, skip: 0, fullResponse: true });

      const threads = JSON.parse(result.content[0].text);
      expect(threads[0].extraField).toBe("included");
    });

    it("should handle null response from getThreads", async () => {
      const handler = getHandler("repo_list_pull_request_threads");
      mockGitApi.getThreads.mockResolvedValue(null);

      const result = await handler({ repositoryId: "repo1", pullRequestId: 1, top: 100, skip: 0, fullResponse: false });

      // When API returns null, the optional chaining results in undefined JSON
      expect(result.content[0].text).toBeUndefined();
    });

    it("should sort threads with undefined id using fallback 0", async () => {
      const handler = getHandler("repo_list_pull_request_threads");
      mockGitApi.getThreads.mockResolvedValue([
        { id: undefined, publishedDate: "2024-01-01", lastUpdatedDate: "2024-01-01", status: 1, comments: [] },
        { id: 2, publishedDate: "2024-01-02", lastUpdatedDate: "2024-01-02", status: 1, comments: [] },
      ]);

      const result = await handler({ repositoryId: "repo1", pullRequestId: 1, top: 100, skip: 0, fullResponse: false });

      const threads = JSON.parse(result.content[0].text);
      expect(threads).toHaveLength(2);
    });
  });

  describe("repo_list_pull_request_thread_comments tool", () => {
    it("should return trimmed comments by default", async () => {
      const handler = getHandler("repo_list_pull_request_thread_comments");
      const mockComments = [
        { id: 1, isDeleted: false, author: { displayName: "User", uniqueName: "user@test.com" }, content: "A comment", publishedDate: "2024-01-01", lastUpdatedDate: "2024-01-01", lastContentUpdatedDate: "2024-01-01" },
      ];
      mockGitApi.getComments.mockResolvedValue(mockComments);

      const result = await handler({ repositoryId: "repo1", pullRequestId: 1, threadId: 5, top: 100, skip: 0, fullResponse: false });

      const comments = JSON.parse(result.content[0].text);
      expect(comments[0].content).toBe("A comment");
    });

    it("should return full response when fullResponse is true", async () => {
      const handler = getHandler("repo_list_pull_request_thread_comments");
      const mockComments = [{ id: 1, isDeleted: false, content: "A comment", extra: "data" }];
      mockGitApi.getComments.mockResolvedValue(mockComments);

      const result = await handler({ repositoryId: "repo1", pullRequestId: 1, threadId: 5, top: 100, skip: 0, fullResponse: true });

      const comments = JSON.parse(result.content[0].text);
      expect(comments[0].extra).toBe("data");
    });

    it("should handle null response from getComments", async () => {
      const handler = getHandler("repo_list_pull_request_thread_comments");
      mockGitApi.getComments.mockResolvedValue(null);

      const result = await handler({ repositoryId: "repo1", pullRequestId: 1, threadId: 5, top: 100, skip: 0, fullResponse: false });

      // When API returns null, the optional chaining results in undefined JSON
      expect(result.content[0].text).toBeUndefined();
    });

    it("should sort comments with undefined id using fallback 0", async () => {
      const handler = getHandler("repo_list_pull_request_thread_comments");
      mockGitApi.getComments.mockResolvedValue([
        { id: undefined, isDeleted: false, author: { displayName: "User", uniqueName: "user@test.com" }, content: "First", publishedDate: "2024-01-01", lastUpdatedDate: "2024-01-01", lastContentUpdatedDate: "2024-01-01" },
        { id: 2, isDeleted: false, author: { displayName: "User2", uniqueName: "user2@test.com" }, content: "Second", publishedDate: "2024-01-01", lastUpdatedDate: "2024-01-01", lastContentUpdatedDate: "2024-01-01" },
      ]);

      const result = await handler({ repositoryId: "repo1", pullRequestId: 1, threadId: 5, top: 100, skip: 0, fullResponse: false });

      const comments = JSON.parse(result.content[0].text);
      expect(comments).toHaveLength(2);
    });
  });

  describe("repo_list_branches_by_repo tool", () => {
    it("should return filtered branch names", async () => {
      const handler = getHandler("repo_list_branches_by_repo");
      mockGitApi.getRefs.mockResolvedValue([
        { name: "refs/heads/main" },
        { name: "refs/heads/feature" },
        { name: "refs/tags/v1.0" },
      ]);

      const result = await handler({ repositoryId: "repo1", top: 100 });

      const branches = JSON.parse(result.content[0].text);
      expect(branches).toContain("main");
      expect(branches).toContain("feature");
      expect(branches).not.toContain("refs/tags/v1.0");
    });

    it("should skip branches without a name", async () => {
      const handler = getHandler("repo_list_branches_by_repo");
      mockGitApi.getRefs.mockResolvedValue([
        { name: "refs/heads/main" },
        {}, // branch without a name
        { name: "refs/heads/feature" },
      ]);

      const result = await handler({ repositoryId: "repo1", top: 100 });

      const branches = JSON.parse(result.content[0].text);
      expect(branches).toHaveLength(2);
      expect(branches).toContain("main");
      expect(branches).toContain("feature");
    });
  });

  describe("repo_list_my_branches_by_repo tool", () => {
    it("should return my branch names with creatorId filter", async () => {
      const handler = getHandler("repo_list_my_branches_by_repo");
      mockGitApi.getRefs.mockResolvedValue([{ name: "refs/heads/my-feature" }]);

      const result = await handler({ repositoryId: "repo1", top: 50 });

      expect(mockGitApi.getRefs).toHaveBeenCalledWith("repo1", undefined, undefined, undefined, undefined, true);
      const branches = JSON.parse(result.content[0].text);
      expect(branches).toContain("my-feature");
    });
  });

  describe("repo_get_repo_by_name_or_id tool", () => {
    it("should return repository when found by name", async () => {
      const handler = getHandler("repo_get_repo_by_name_or_id");
      const mockRepo = { id: "r1", name: "my-repo" };
      mockGitApi.getRepositories.mockResolvedValue([mockRepo, { id: "r2", name: "other-repo" }]);

      const result = await handler({ project: "proj1", repositoryNameOrId: "my-repo" });

      expect(result.content[0].text).toBe(JSON.stringify(mockRepo, null, 2));
    });

    it("should return repository when found by id", async () => {
      const handler = getHandler("repo_get_repo_by_name_or_id");
      const mockRepo = { id: "r1", name: "my-repo" };
      mockGitApi.getRepositories.mockResolvedValue([mockRepo]);

      const result = await handler({ project: "proj1", repositoryNameOrId: "r1" });

      expect(result.content[0].text).toBe(JSON.stringify(mockRepo, null, 2));
    });

    it("should throw when repository is not found", async () => {
      const handler = getHandler("repo_get_repo_by_name_or_id");
      mockGitApi.getRepositories.mockResolvedValue([{ id: "r2", name: "other-repo" }]);

      await expect(handler({ project: "proj1", repositoryNameOrId: "nonexistent" })).rejects.toThrow("Repository nonexistent not found in project proj1");
    });
  });

  describe("repo_get_branch_by_name tool", () => {
    it("should return branch when found", async () => {
      const handler = getHandler("repo_get_branch_by_name");
      const mockBranch = { name: "refs/heads/main", objectId: "abc123" };
      mockGitApi.getRefs.mockResolvedValue([mockBranch]);

      const result = await handler({ repositoryId: "repo1", branchName: "main" });

      expect(result.content[0].text).toBe(JSON.stringify(mockBranch, null, 2));
    });

    it("should return not found message when branch does not exist", async () => {
      const handler = getHandler("repo_get_branch_by_name");
      mockGitApi.getRefs.mockResolvedValue([{ name: "refs/heads/main" }]);

      const result = await handler({ repositoryId: "repo1", branchName: "nonexistent" });

      expect(result.content[0].text).toContain("Branch nonexistent not found");
    });
  });

  describe("repo_get_pull_request_by_id tool", () => {
    it("should return pull request by ID", async () => {
      const handler = getHandler("repo_get_pull_request_by_id");
      const mockPR = { pullRequestId: 42, title: "Fix issue" };
      mockGitApi.getPullRequest.mockResolvedValue(mockPR);

      const result = await handler({ repositoryId: "repo1", pullRequestId: 42 });

      expect(mockGitApi.getPullRequest).toHaveBeenCalledWith("repo1", 42);
      expect(result.content[0].text).toBe(JSON.stringify(mockPR, null, 2));
    });
  });

  describe("repo_reply_to_comment tool", () => {
    it("should reply to comment and return success message by default", async () => {
      const handler = getHandler("repo_reply_to_comment");
      mockGitApi.createComment.mockResolvedValue({ id: 1, content: "Reply" });

      const result = await handler({ repositoryId: "repo1", pullRequestId: 1, threadId: 5, content: "My reply", fullResponse: false });

      expect(mockGitApi.createComment).toHaveBeenCalledWith({ content: "My reply" }, "repo1", 1, 5, undefined);
      expect(result.content[0].text).toContain("Comment successfully added to thread 5");
    });

    it("should return full response when fullResponse is true", async () => {
      const handler = getHandler("repo_reply_to_comment");
      const mockComment = { id: 1, content: "Reply", author: { displayName: "User" } };
      mockGitApi.createComment.mockResolvedValue(mockComment);

      const result = await handler({ repositoryId: "repo1", pullRequestId: 1, threadId: 5, content: "My reply", fullResponse: true });

      expect(result.content[0].text).toBe(JSON.stringify(mockComment, null, 2));
    });

    it("should return error when comment creation fails", async () => {
      const handler = getHandler("repo_reply_to_comment");
      mockGitApi.createComment.mockResolvedValue(null);

      const result = await handler({ repositoryId: "repo1", pullRequestId: 1, threadId: 5, content: "My reply", fullResponse: false });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Failed to add comment");
    });
  });

  describe("repo_create_pull_request_thread tool", () => {
    it("should create a thread without file context", async () => {
      const handler = getHandler("repo_create_pull_request_thread");
      const mockThread = { id: 1, comments: [{ content: "Thread comment" }] };
      mockGitApi.createThread.mockResolvedValue(mockThread);

      const result = await handler({ repositoryId: "repo1", pullRequestId: 1, content: "Thread comment" });

      expect(mockGitApi.createThread).toHaveBeenCalled();
      expect(result.content[0].text).toBe(JSON.stringify(mockThread, null, 2));
    });

    it("should set file context when filePath is provided", async () => {
      const handler = getHandler("repo_create_pull_request_thread");
      mockGitApi.createThread.mockResolvedValue({ id: 1 });

      await handler({ repositoryId: "repo1", pullRequestId: 1, content: "Comment", filePath: "/src/main.ts" });

      const threadArg = mockGitApi.createThread.mock.calls[0][0];
      expect(threadArg.threadContext.filePath).toBe("/src/main.ts");
    });

    it("should set rightFileStart when rightFileStartLine is provided", async () => {
      const handler = getHandler("repo_create_pull_request_thread");
      mockGitApi.createThread.mockResolvedValue({ id: 1 });

      await handler({
        repositoryId: "repo1",
        pullRequestId: 1,
        content: "Comment",
        filePath: "/src/main.ts",
        rightFileStartLine: 10,
        rightFileStartOffset: 5,
      });

      const threadArg = mockGitApi.createThread.mock.calls[0][0];
      expect(threadArg.threadContext.rightFileStart).toEqual({ line: 10, offset: 5 });
    });

    it("should throw when rightFileStartLine is less than 1", async () => {
      const handler = getHandler("repo_create_pull_request_thread");

      await expect(
        handler({ repositoryId: "repo1", pullRequestId: 1, content: "Comment", rightFileStartLine: 0 })
      ).rejects.toThrow("rightFileStartLine must be greater than or equal to 1.");
    });

    it("should throw when rightFileStartOffset is less than 1", async () => {
      const handler = getHandler("repo_create_pull_request_thread");

      await expect(
        handler({ repositoryId: "repo1", pullRequestId: 1, content: "Comment", rightFileStartLine: 5, rightFileStartOffset: 0 })
      ).rejects.toThrow("rightFileStartOffset must be greater than or equal to 1.");
    });

    it("should throw when rightFileEndLine is set without rightFileStartLine", async () => {
      const handler = getHandler("repo_create_pull_request_thread");

      await expect(
        handler({ repositoryId: "repo1", pullRequestId: 1, content: "Comment", rightFileEndLine: 10 })
      ).rejects.toThrow("rightFileEndLine must only be specified if rightFileStartLine is also specified.");
    });

    it("should set rightFileEnd when rightFileEndLine and rightFileEndOffset are provided", async () => {
      const handler = getHandler("repo_create_pull_request_thread");
      mockGitApi.createThread.mockResolvedValue({ id: 1 });

      await handler({
        repositoryId: "repo1",
        pullRequestId: 1,
        content: "Comment",
        rightFileStartLine: 5,
        rightFileEndLine: 10,
        rightFileEndOffset: 3,
      });

      const threadArg = mockGitApi.createThread.mock.calls[0][0];
      expect(threadArg.threadContext.rightFileEnd).toEqual({ line: 10, offset: 3 });
    });

    it("should throw when rightFileEndLine is less than 1", async () => {
      const handler = getHandler("repo_create_pull_request_thread");

      await expect(
        handler({ repositoryId: "repo1", pullRequestId: 1, content: "Comment", rightFileStartLine: 5, rightFileEndLine: 0 })
      ).rejects.toThrow("rightFileEndLine must be greater than or equal to 1.");
    });

    it("should throw when rightFileEndOffset is less than 1", async () => {
      const handler = getHandler("repo_create_pull_request_thread");

      await expect(
        handler({
          repositoryId: "repo1",
          pullRequestId: 1,
          content: "Comment",
          rightFileStartLine: 5,
          rightFileEndLine: 10,
          rightFileEndOffset: 0,
        })
      ).rejects.toThrow("rightFileEndOffset must be greater than or equal to 1.");
    });

    it("should set rightFileEnd without offset when rightFileEndLine is set but rightFileEndOffset is not", async () => {
      const handler = getHandler("repo_create_pull_request_thread");
      mockGitApi.createThread.mockResolvedValue({ id: 1 });

      await handler({
        repositoryId: "repo1",
        pullRequestId: 1,
        content: "Comment",
        rightFileStartLine: 5,
        rightFileEndLine: 10,
        // rightFileEndOffset intentionally not provided
      });

      const threadArg = mockGitApi.createThread.mock.calls[0][0];
      expect(threadArg.threadContext.rightFileEnd).toEqual({ line: 10 });
      expect(threadArg.threadContext.rightFileEnd.offset).toBeUndefined();
    });

    it("should set rightFileStart without offset when rightFileStartOffset is not provided", async () => {
      const handler = getHandler("repo_create_pull_request_thread");
      mockGitApi.createThread.mockResolvedValue({ id: 1 });

      await handler({
        repositoryId: "repo1",
        pullRequestId: 1,
        content: "Comment",
        filePath: "/src/main.ts",
        rightFileStartLine: 10,
        // rightFileStartOffset intentionally not provided
      });

      const threadArg = mockGitApi.createThread.mock.calls[0][0];
      expect(threadArg.threadContext.rightFileStart).toEqual({ line: 10 });
      expect(threadArg.threadContext.rightFileStart.offset).toBeUndefined();
    });
  });

  describe("repo_resolve_comment tool", () => {
    it("should resolve thread and return success message", async () => {
      const handler = getHandler("repo_resolve_comment");
      mockGitApi.updateThread.mockResolvedValue({ id: 5, status: 2 });

      const result = await handler({ repositoryId: "repo1", pullRequestId: 1, threadId: 5, fullResponse: false });

      expect(mockGitApi.updateThread).toHaveBeenCalledWith({ status: 2 }, "repo1", 1, 5);
      expect(result.content[0].text).toContain("Thread 5 was successfully resolved.");
    });

    it("should return full response when fullResponse is true", async () => {
      const handler = getHandler("repo_resolve_comment");
      const mockThread = { id: 5, status: 2, extra: "data" };
      mockGitApi.updateThread.mockResolvedValue(mockThread);

      const result = await handler({ repositoryId: "repo1", pullRequestId: 1, threadId: 5, fullResponse: true });

      expect(result.content[0].text).toBe(JSON.stringify(mockThread, null, 2));
    });

    it("should return error when thread update fails", async () => {
      const handler = getHandler("repo_resolve_comment");
      mockGitApi.updateThread.mockResolvedValue(null);

      const result = await handler({ repositoryId: "repo1", pullRequestId: 1, threadId: 5, fullResponse: false });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Failed to resolve thread");
    });
  });

  describe("repo_search_commits tool", () => {
    it("should return commits matching search criteria", async () => {
      const handler = getHandler("repo_search_commits");
      const mockCommits = [{ commitId: "abc123", comment: "Fix bug" }];
      mockGitApi.getCommits.mockResolvedValue(mockCommits);

      const result = await handler({
        project: "proj1",
        repository: "repo1",
        skip: 0,
        top: 10,
        includeLinks: false,
        includeWorkItems: false,
        versionType: "Branch",
      });

      expect(mockGitApi.getCommits).toHaveBeenCalled();
      expect(result.content[0].text).toBe(JSON.stringify(mockCommits, null, 2));
    });

    it("should include version descriptor when version is provided", async () => {
      const handler = getHandler("repo_search_commits");
      mockGitApi.getCommits.mockResolvedValue([]);

      await handler({
        project: "proj1",
        repository: "repo1",
        version: "main",
        versionType: "Branch",
        skip: 0,
        top: 10,
        includeLinks: false,
        includeWorkItems: false,
      });

      const searchCriteria = mockGitApi.getCommits.mock.calls[0][1];
      expect(searchCriteria.itemVersion).toBeDefined();
      expect(searchCriteria.itemVersion.version).toBe("main");
    });

    it("should handle errors and return error content", async () => {
      const handler = getHandler("repo_search_commits");
      mockGitApi.getCommits.mockRejectedValue(new Error("Repository not found"));

      const result = await handler({
        project: "proj1",
        repository: "nonexistent",
        skip: 0,
        top: 10,
        includeLinks: false,
        includeWorkItems: false,
        versionType: "Branch",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Repository not found");
    });

    it("should handle non-Error objects thrown in catch block", async () => {
      const handler = getHandler("repo_search_commits");
      mockGitApi.getCommits.mockRejectedValue("string error value");

      const result = await handler({
        project: "proj1",
        repository: "repo1",
        skip: 0,
        top: 10,
        includeLinks: false,
        includeWorkItems: false,
        versionType: "Branch",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("string error value");
    });
  });

  describe("repo_list_pull_requests_by_commits tool", () => {
    it("should return pull requests that contain the given commits", async () => {
      const handler = getHandler("repo_list_pull_requests_by_commits");
      const mockResult = { results: [{ commitId: "abc123", pullRequests: [{ pullRequestId: 1 }] }] };
      mockGitApi.getPullRequestQuery.mockResolvedValue(mockResult);

      const result = await handler({
        project: "proj1",
        repository: "repo1",
        commits: ["abc123"],
        queryType: "LastMergeCommit",
      });

      expect(mockGitApi.getPullRequestQuery).toHaveBeenCalled();
      expect(result.content[0].text).toBe(JSON.stringify(mockResult, null, 2));
    });

    it("should handle errors and return error content", async () => {
      const handler = getHandler("repo_list_pull_requests_by_commits");
      mockGitApi.getPullRequestQuery.mockRejectedValue(new Error("Query failed"));

      const result = await handler({
        project: "proj1",
        repository: "repo1",
        commits: ["abc123"],
        queryType: "LastMergeCommit",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Query failed");
    });

    it("should handle non-Error objects thrown in catch block", async () => {
      const handler = getHandler("repo_list_pull_requests_by_commits");
      mockGitApi.getPullRequestQuery.mockRejectedValue("string error value");

      const result = await handler({
        project: "proj1",
        repository: "repo1",
        commits: ["abc123"],
        queryType: "LastMergeCommit",
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("string error value");
    });
  });
});
