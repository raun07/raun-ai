import { SignUp, useAuth } from "@clerk/clerk-react";
import { Link, Navigate } from "react-router-dom";

function SignupPage() {
  const { isSignedIn } = useAuth();
  if (isSignedIn) return <Navigate to="/studio" replace />;

  return (
    <>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 20px",
          background:
            "radial-gradient(circle at top, rgba(86,180,233,0.22), transparent 35%), #09070c",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            display: "grid",
            gap: "20px",
            justifyItems: "center",
          }}
        >
          <div style={{ textAlign: "center", color: "#fff" }}>
            <h1 style={{ margin: 0, fontSize: "40px" }}>Create your account</h1>
            <p style={{ marginTop: "10px", color: "rgba(255,255,255,0.7)" }}>
              Start turning prompts into polished reels.
            </p>
          </div>
          <SignUp path="/signup" routing="path" signInUrl="/login" forceRedirectUrl="/studio" />
          <p style={{ color: "rgba(255,255,255,0.72)" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: "#74c0fc" }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

export default SignupPage;
