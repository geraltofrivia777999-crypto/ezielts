import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

import ForgotPasswordPage from "@/app/forgot-password/page";
import { createClient } from "@/lib/supabase/client";

const resetPasswordForEmail = vi.fn();

describe("forgot password page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPasswordForEmail.mockResolvedValue({ error: null });
    (createClient as Mock).mockReturnValue({
      auth: { resetPasswordForEmail },
    });
  });

  it("requests a recovery link that returns through the server callback", async () => {
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сбросить пароль" }));

    await waitFor(() => {
      expect(resetPasswordForEmail).toHaveBeenCalledWith("user@example.com", {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
      });
    });
    expect(await screen.findByText("Письмо отправлено!")).toBeInTheDocument();
  });
});
