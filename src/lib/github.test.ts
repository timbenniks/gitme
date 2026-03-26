import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { createClient } from "./github";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function okResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

function errorResponse(status: number, statusText: string, body: string) {
  return {
    ok: false,
    status,
    statusText,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(body),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("createClient", () => {
  describe("listPRs", () => {
    it("calls fetch with correct URL and returns parsed JSON", async () => {
      const prs = [{ number: 1, title: "Test PR" }];
      mockFetch.mockResolvedValueOnce(okResponse(prs));

      const client = createClient("test-token");
      const result = await client.listPRs("myorg", "myrepo");

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toBe("https://api.github.com/repos/myorg/myrepo/pulls?state=open&per_page=30");
      expect(result).toEqual(prs);
    });
  });

  describe("createPR", () => {
    it("POSTs with correct body", async () => {
      const pr = { number: 2, title: "New PR" };
      mockFetch.mockResolvedValueOnce(okResponse(pr));

      const client = createClient("test-token");
      await client.createPR("myorg", "myrepo", {
        title: "New PR",
        body: "Description",
        head: "feature",
        base: "main",
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, opts] = mockFetch.mock.calls[0]!;
      expect(url).toBe("https://api.github.com/repos/myorg/myrepo/pulls");
      expect(opts.method).toBe("POST");
      expect(JSON.parse(opts.body)).toEqual({
        title: "New PR",
        body: "Description",
        head: "feature",
        base: "main",
      });
    });
  });

  describe("getPR", () => {
    it("calls correct endpoint", async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ number: 42 }));

      const client = createClient("test-token");
      await client.getPR("myorg", "myrepo", 42);

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toBe("https://api.github.com/repos/myorg/myrepo/pulls/42");
    });
  });

  describe("listIssues", () => {
    it("calls correct endpoint", async () => {
      mockFetch.mockResolvedValueOnce(okResponse([]));

      const client = createClient("test-token");
      await client.listIssues("myorg", "myrepo");

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toBe("https://api.github.com/repos/myorg/myrepo/issues?state=open&per_page=30");
    });
  });

  describe("getIssue", () => {
    it("calls correct endpoint", async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ number: 7 }));

      const client = createClient("test-token");
      await client.getIssue("myorg", "myrepo", 7);

      const [url] = mockFetch.mock.calls[0]!;
      expect(url).toBe("https://api.github.com/repos/myorg/myrepo/issues/7");
    });
  });

  describe("getPRStatus", () => {
    it("makes ONE API call and filters by username", async () => {
      const prs = [
        {
          number: 1,
          user: { login: "alice" },
          requested_reviewers: [{ login: "bob" }],
        },
        {
          number: 2,
          user: { login: "bob" },
          requested_reviewers: [{ login: "alice" }],
        },
        {
          number: 3,
          user: { login: "charlie" },
          requested_reviewers: [],
        },
      ];
      mockFetch.mockResolvedValueOnce(okResponse(prs));

      const client = createClient("test-token");
      const result = await client.getPRStatus("myorg", "myrepo", "alice");

      // Only ONE API call, not two
      expect(mockFetch).toHaveBeenCalledTimes(1);

      expect(result.authored).toHaveLength(1);
      expect(result.authored[0]!.number).toBe(1);

      expect(result.reviewRequested).toHaveLength(1);
      expect(result.reviewRequested[0]!.number).toBe(2);
    });
  });

  describe("auth header", () => {
    it("includes auth header when token provided", async () => {
      mockFetch.mockResolvedValueOnce(okResponse([]));

      const client = createClient("my-secret-token");
      await client.listPRs("o", "r");

      const [, opts] = mockFetch.mock.calls[0]!;
      expect(opts.headers.Authorization).toBe("token my-secret-token");
    });

    it("omits auth header when token is null", async () => {
      mockFetch.mockResolvedValueOnce(okResponse([]));

      const client = createClient(null);
      await client.listPRs("o", "r");

      const [, opts] = mockFetch.mock.calls[0]!;
      expect(opts.headers.Authorization).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("throws on non-ok response with status info", async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404, "Not Found", "repo not found"));

      const client = createClient("test-token");

      await expect(client.getPR("myorg", "myrepo", 999)).rejects.toThrow(
        "GitHub API error: 404 Not Found",
      );
    });
  });
});
