export function GradientMeshBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Indigo blob */}
      <div
        className="absolute w-[800px] h-[800px] rounded-full will-change-transform animate-drift-1"
        style={{
          top: "10%",
          left: "20%",
          background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)",
          filter: "blur(120px)",
        }}
      />
      {/* Violet blob */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full will-change-transform animate-drift-2"
        style={{
          top: "70%",
          left: "70%",
          background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)",
          filter: "blur(100px)",
        }}
      />
      {/* Emerald blob */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full will-change-transform animate-drift-3"
        style={{
          top: "40%",
          left: "60%",
          background: "radial-gradient(circle, rgba(52,211,153,0.03) 0%, transparent 70%)",
          filter: "blur(140px)",
        }}
      />
      {/* Dot grid overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.015) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
    </div>
  );
}
