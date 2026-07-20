import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

import ResetPasswordPage from "@/app/reset-password/page";
import { createClient } from "@/lib/supabase/client";

const getUser = vi.fn();
const updateUser = vi.fn();
const unsubscribe = vi.fn();
const onAuthStateChange = vi.fn(() => ({ data: { subscription: { unsubscribe } } }));

describe("reset password page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    updateUser.mockResolvedValue({ error: null });
    (createClient as Mock).mockReturnValue({
      auth: { getUser, updateUser, onAuthStateChange },
    });
  });

  it("accepts a recovery session created by the server callback", async () => {
    render(<ResetPasswordPage />);

    const submit = screen.getByRole("button", { name: "Сохранить пароль" });
    await waitFor(() => expect(submit).toBeEnabled());

    fireEvent.change(screen.getByPlaceholderText("Новый пароль (мин. 8 символов)"), {
      target: { value: "new-password" },
    });
    fireEvent.change(screen.getByPlaceholderText("Повторите пароль"), {
      target: { value: "new-password" },
    });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ password: "new-password" });
    });
    expect(await screen.findByText("Пароль обновлён!")).toBeInTheDocument();
  });

  it("blocks password changes when the recovery session is missing", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    render(<ResetPasswordPage />);

    expect(await screen.findByText(/Ссылка недействительна или уже истекла/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Сохранить пароль" })).toBeDisabled();
    expect(updateUser).not.toHaveBeenCalled();
  });
});
