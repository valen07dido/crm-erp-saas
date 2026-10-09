import { withAuth } from "next-auth/middleware";

const DEMO_COOKIE = "walti-demo-active";

export default withAuth({
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    authorized: ({ req, token }) => {
      if (token) return true;
      // "Probar Walti" lets visitors into /dashboard (never /superadmin)
      // without a real session — a cookie set client-side when they click
      // the button. Every API call in there is answered locally by the demo
      // sandbox (src/lib/demo-mode.ts), the real backend is never touched.
      if (req.nextUrl.pathname.startsWith("/dashboard") && req.cookies.get(DEMO_COOKIE)?.value === "true") {
        return true;
      }
      return false;
    },
  },
});

export const config = {
  matcher: ["/dashboard/:path*", "/superadmin/:path*"],
};
