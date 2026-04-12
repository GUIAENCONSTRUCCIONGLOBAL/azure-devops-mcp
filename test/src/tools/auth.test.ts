// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AccessToken } from "@azure/identity";
import { describe, expect, it, beforeEach } from "@jest/globals";
import { WebApi } from "azure-devops-node-api";
import { getCurrentUserDetails } from "../../../src/tools/auth";

global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

type TokenProviderMock = () => Promise<AccessToken>;
type ConnectionProviderMock = () => Promise<WebApi>;

describe("getCurrentUserDetails", () => {
  let tokenProvider: TokenProviderMock;
  let connectionProvider: ConnectionProviderMock;
  let mockConnection: { serverUrl: string };

  beforeEach(() => {
    mockConnection = { serverUrl: "https://dev.azure.com/test-org" };
    tokenProvider = jest.fn().mockResolvedValue({ token: "mock-token" });
    connectionProvider = jest.fn().mockResolvedValue(mockConnection);
    (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();
  });

  it("should return user details on success", async () => {
    const mockUserData = {
      authenticatedUser: {
        id: "user-123",
        providerDisplayName: "Test User",
      },
    };

    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockUserData),
    } as unknown as Response);

    const result = await getCurrentUserDetails(tokenProvider, connectionProvider);

    expect(global.fetch).toHaveBeenCalledWith("https://dev.azure.com/test-org/_apis/connectionData", {
      method: "GET",
      headers: {
        "Authorization": "Bearer mock-token",
        "Content-Type": "application/json",
      },
    });
    expect(result).toEqual(mockUserData);
  });

  it("should throw an error when the API response is not ok", async () => {
    const errorData = { message: "Unauthorized" };

    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: false,
      json: jest.fn().mockResolvedValue(errorData),
    } as unknown as Response);

    await expect(getCurrentUserDetails(tokenProvider, connectionProvider)).rejects.toThrow("Error fetching user details: Unauthorized");
  });

  it("should call connectionProvider and tokenProvider to build request", async () => {
    const mockUserData = { authenticatedUser: { id: "user-abc" } };

    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockUserData),
    } as unknown as Response);

    await getCurrentUserDetails(tokenProvider, connectionProvider);

    expect(tokenProvider).toHaveBeenCalled();
    expect(connectionProvider).toHaveBeenCalled();
  });
});
