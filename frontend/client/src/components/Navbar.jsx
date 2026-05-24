import { Link, useLocation } from "react-router-dom";
import { UserButton, useUser } from "@clerk/clerk-react";

const NAV_LINKS = [
  { to: "/studio",    label: "Studio",    index: "01" },
  { to: "/pricing",   label: "Pricing",   index: "02" },
  { to: "/brand-kit", label: "Brand Kit", index: "03", authOnly: true },
  { to: "/evals",     label: "Evals",     index: "04", authOnly: true },
];

function NavLink({ to, label }) {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      style={{
        fontFamily: 'Caveat, cursive',
        fontSize: 20,
        color: active ? '#c94030' : '#3d2b1a',
        textDecoration: active ? 'underline' : 'none',
        textDecorationStyle: active ? 'wavy' : undefined,
        textDecorationColor: active ? '#c94030' : undefined,
        textUnderlineOffset: '4px',
        transition: 'color 0.15s',
        fontWeight: active ? 700 : 400,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = '#1a1008'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = '#3d2b1a'; }}
    >
      {label}
    </Link>
  );
}

function Navbar({ userProfile }) {
  const { isSignedIn } = useUser();
  const tier    = userProfile?.tier;
  const credits = tier === "pro" ? "pro" : userProfile?.credits ?? null;

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      width: '100%',
      background: 'rgba(245,240,232,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '2px solid #c94030',
    }}>
      <div style={{
        maxWidth: 1600,
        margin: '0 auto',
        padding: '0 24px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 32,
      }}>

        {/* Logo */}
        <Link
          to="/"
          style={{ textDecoration: 'none', flexShrink: 0 }}
        >
          <span style={{ fontFamily: 'Caveat, cursive', fontSize: 32, fontWeight: 700, color: '#c94030', lineHeight: 1 }}>raun</span>
          <span style={{ fontFamily: 'Caveat, cursive', fontSize: 24, fontWeight: 700, color: '#1a1008', lineHeight: 1 }}>.ai</span>
        </Link>

        {/* Center nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {NAV_LINKS.filter((l) => !l.authOnly || isSignedIn).map((l) => (
            <NavLink key={l.to} to={l.to} label={l.label} />
          ))}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {isSignedIn && credits !== null && (
            <span style={{
              fontFamily: 'Caveat, cursive',
              fontSize: 16,
              padding: '3px 12px',
              borderRadius: 20,
              border: '1.5px solid rgba(201,64,48,0.4)',
              background: 'rgba(201,64,48,0.08)',
              color: '#c94030',
            }}>
              {credits === "pro" ? "✦ pro" : `${credits} reels left`}
            </span>
          )}

          {!isSignedIn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Link
                to="/login"
                style={{
                  fontFamily: 'Caveat, cursive',
                  fontSize: 18,
                  color: '#3d2b1a',
                  border: '2px solid #1a1008',
                  borderRadius: 4,
                  padding: '4px 14px',
                  boxShadow: '2px 2px 0 #1a1008',
                  textDecoration: 'none',
                  transition: 'transform 0.1s, box-shadow 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translate(-1px,-1px)'; e.currentTarget.style.boxShadow = '3px 3px 0 #1a1008'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '2px 2px 0 #1a1008'; }}
              >sign in</Link>
              <Link
                to="/signup"
                style={{
                  fontFamily: 'Caveat, cursive',
                  fontSize: 18,
                  background: '#c94030',
                  color: '#fff',
                  border: '2px solid #1a1008',
                  borderRadius: 4,
                  padding: '4px 14px',
                  boxShadow: '2px 2px 0 #1a1008',
                  textDecoration: 'none',
                  transition: 'transform 0.1s, box-shadow 0.1s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translate(-1px,-1px)'; e.currentTarget.style.boxShadow = '3px 3px 0 #1a1008'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '2px 2px 0 #1a1008'; }}
              >start free →</Link>
            </div>
          ) : (
            <UserButton afterSignOutUrl="/" />
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
