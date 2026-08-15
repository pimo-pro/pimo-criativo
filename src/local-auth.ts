export function tryLocalAuth(email: string, password: string) {
  if (email === "K" && password === "K") {
    const fakeSession = {
      token: "local-dev-token",
      user: {
        id: "local-user",
        name: "Khaled Local",
        role: "industrial",
      },
      local: true,
    };

    localStorage.setItem("pimo_session", JSON.stringify(fakeSession));
    return true;
  }

  return false;
}

export function readLocalAuthSession(): {
  token: string;
  user: { id: string; name: string; role: string };
  local: true;
} | null {
  try {
    const raw = localStorage.getItem("pimo_session");
    if (!raw) return null;
    const data = JSON.parse(raw) as {
      token?: string;
      user?: { id?: string; name?: string; role?: string };
      local?: boolean;
    };
    if (
      !data?.local ||
      !data.token ||
      !data.user?.id ||
      !data.user?.name ||
      !data.user?.role
    ) {
      return null;
    }
    return {
      token: data.token,
      user: {
        id: data.user.id,
        name: data.user.name,
        role: data.user.role,
      },
      local: true,
    };
  } catch {
    return null;
  }
}

export function clearLocalAuthSession() {
  localStorage.removeItem("pimo_session");
}

export function isLocalAuthSession(): boolean {
  return readLocalAuthSession() !== null;
}
