import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createServiceClient: vi.fn() }));

import { POST } from "@/app/api/auth/signup/route";
import { createServiceClient } from "@/lib/supabase/server";

function request(body: unknown) {
  return new Request("https://app.test/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function serviceMock(createUserResult = { data: { user: { id: "user-1" } }, error: null }) {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return {
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue(createUserResult),
      },
    },
    from,
    update,
    eq,
  };
}

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_SERVICE_KEY = "service-key";
  });

  it("creates an already-confirmed user without sending signup confirmation", async () => {
    const service = serviceMock();
    (createServiceClient as Mock).mockReturnValue(service);

    const res = await POST(request({
      email: " User@Example.com ",
      password: "password123",
      name: "Adil",
      phone: "+77001234567",
      phoneCountry: "KZ",
    }));

    expect(res.status).toBe(200);
    expect(service.auth.admin.createUser).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
      email_confirm: true,
      user_metadata: {
        name: "Adil",
        phone: "+77001234567",
        phone_country: "KZ",
      },
    });
    expect(service.from).toHaveBeenCalledWith("profiles");
    expect(service.update).toHaveBeenCalledWith({
      name: "Adil",
      email: "user@example.com",
      phone: "+77001234567",
    });
    expect(service.eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("rejects missing fields before calling Supabase", async () => {
    const service = serviceMock();
    (createServiceClient as Mock).mockReturnValue(service);

    const res = await POST(request({ email: "user@example.com" }));

    expect(res.status).toBe(400);
    expect(service.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("returns a friendly duplicate-user error", async () => {
    const service = serviceMock({
      data: { user: null },
      error: new Error("A user with this email address has already been registered"),
    });
    (createServiceClient as Mock).mockReturnValue(service);

    const res = await POST(request({
      email: "user@example.com",
      password: "password123",
      name: "Adil",
      phone: "+77001234567",
      phoneCountry: "KZ",
    }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toMatchObject({
      message: "Пользователь с таким email уже существует",
    });
  });
});
