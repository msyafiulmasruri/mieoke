import React from "react";

const palettes = [
  { bg: "#F3D8C7", bowl: "#B63B2C", sauce: "#E9A34D", noodle: "#FFF0CC", green: "#527B45", red: "#C84B31" },
  { bg: "#E3E8D6", bowl: "#314D3A", sauce: "#D98C3D", noodle: "#FFF1D2", green: "#78934E", red: "#B63B2C" },
  { bg: "#F4E4B9", bowl: "#7A3E2D", sauce: "#C85C35", noodle: "#FFF3D8", green: "#4F7844", red: "#D14B2E" },
  { bg: "#E8DDF0", bowl: "#754B69", sauce: "#E6A54B", noodle: "#FFF1D1", green: "#5C8750", red: "#C84B31" },
];

export default function FoodArtwork({ variant = 0, className = "" }: { variant?: number; className?: string }) {
  const p = palettes[Math.abs(variant) % palettes.length];
  return (
    <div className={`food-art ${className}`} style={{ "--art-bg": p.bg } as React.CSSProperties} aria-hidden="true">
      <svg viewBox="0 0 520 390" role="presentation">
        <ellipse cx="260" cy="326" rx="170" ry="25" fill="#38291E" opacity=".12" />
        <circle cx="260" cy="180" r="145" fill="#fff" opacity=".22" />
        <path d="M105 190 C118 282 180 326 260 326 C340 326 402 282 415 190 Z" fill={p.bowl} />
        <path d="M105 190 C118 282 180 326 260 326 C340 326 402 282 415 190" fill="none" stroke="#fff" strokeWidth="8" opacity=".45" />
        <ellipse cx="260" cy="190" rx="156" ry="61" fill="#F9E7C6" />
        <ellipse cx="260" cy="185" rx="143" ry="50" fill={p.sauce} />
        <path d="M145 185 C170 145 192 220 222 178 S272 145 290 188 S333 217 365 171" fill="none" stroke={p.noodle} strokeWidth="10" strokeLinecap="round" />
        <path d="M155 200 C181 166 205 225 236 190 S281 167 305 201 S341 216 367 191" fill="none" stroke="#FFF8E8" strokeWidth="7" strokeLinecap="round" />
        <path d="M174 166 C194 139 211 198 242 164 S288 145 315 178" fill="none" stroke={p.noodle} strokeWidth="8" strokeLinecap="round" />
        <ellipse cx="213" cy="174" rx="27" ry="22" fill="#fff8e9" />
        <circle cx="213" cy="174" r="12" fill="#F2B642" />
        <path d="M286 157 C305 132 340 137 348 162 C331 181 303 184 286 157Z" fill={p.green} />
        <path d="M294 157 C310 153 325 154 340 160" stroke="#B6CB8B" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M160 213 C176 198 191 199 204 211" stroke={p.red} strokeWidth="8" strokeLinecap="round" fill="none" />
        <circle cx="252" cy="212" r="7" fill={p.green} />
        <circle cx="270" cy="220" r="5" fill={p.green} />
        <circle cx="323" cy="203" r="6" fill="#fff3d8" />
        <path d="M110 184 C140 155 380 150 410 184" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" opacity=".75" />
        <path d="M178 290 C214 312 306 312 342 290" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".28" />
      </svg>
    </div>
  );
}
