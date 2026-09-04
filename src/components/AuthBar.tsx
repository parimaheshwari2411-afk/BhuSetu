import { FormEvent, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import type { UserRole } from "../lib/api";

export default function AuthBar() {
  const { user, login, register, logout } = useAuth();
  const [mode, setMode] = useState<"login" | "register" | null>(null);
  const [email, setEmail] = useState("citizen@bhusetu.local");
  const [password, setPassword] = useState("Test123456!");
  const [fullName, setFullName] = useState("Citizen Sharma");
  const [role, setRole] = useState<UserRole>("CITIZEN");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    try {
      if (mode === "register") {
        await register({ fullName, email, password, phoneNumber: "9999999999", role });
      } else {
        await login(email, password);
      }
      setMode(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    }
  }

  if (user) {
    return (
      <div className="flex items-center gap-2 py-2">
        <span className="text-white/80 text-xs">
          {user.fullName} · {user.role}
        </span>
        <button
          onClick={logout}
          className="px-3 py-1.5 border border-white/25 text-white/70 text-xs rounded-sm hover:text-white"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="relative py-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMode("login")}
          className="px-3 py-1.5 border border-white/25 text-white/70 text-xs rounded-sm hover:text-white"
        >
          Sign In
        </button>
        <button
          onClick={() => setMode("register")}
          className="px-3 py-1.5 bg-[#f5a623] text-[#0d1b2e] text-xs font-semibold rounded-sm"
        >
          Register
        </button>
      </div>
      {mode && (
        <form
          onSubmit={onSubmit}
          className="absolute right-0 top-11 z-50 w-80 bg-white text-[#0d1b2e] border border-[#d0d5dd] shadow-lg p-4 space-y-2"
        >
          <div className="text-sm font-semibold text-[#154360]">
            {mode === "login" ? "Sign in to BhuSetu Registry" : "Create registry account"}
          </div>
          {mode === "register" && (
            <>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
                className="w-full border border-[#c8d0e4] px-2 py-1.5 text-xs"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full border border-[#c8d0e4] px-2 py-1.5 text-xs bg-white"
              >
                <option value="CITIZEN">CITIZEN</option>
                <option value="SURVEYOR">SURVEYOR</option>
                <option value="REGISTRAR">REGISTRAR</option>
              </select>
            </>
          )}
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full border border-[#c8d0e4] px-2 py-1.5 text-xs"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full border border-[#c8d0e4] px-2 py-1.5 text-xs"
          />
          {message && <div className="text-xs text-red-700">{message}</div>}
          <div className="flex gap-2">
            <button type="submit" className="flex-1 py-1.5 bg-[#154360] text-white text-xs">
              Continue
            </button>
            <button type="button" onClick={() => setMode(null)} className="px-3 text-xs border">
              Close
            </button>
          </div>
          <p className="text-[10px] text-[#5a6680]">
            Demo: citizen@bhusetu.local / buyer@bhusetu.local / registrar@bhusetu.local · Test123456!
          </p>
        </form>
      )}
    </div>
  );
}
