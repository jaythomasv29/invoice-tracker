import Image from "next/image";

/**
 * A dark titanium / Space Black iPhone frame wrapping a real app screenshot
 * (not an illustration). Pure CSS: layered near-black metal gradients,
 * rounded protruding side buttons, a polished chamfer highlight ring, a
 * glass-reflection streak over the screen, and a soft grounding shadow —
 * no image asset. The screenshots already contain their own status bar +
 * home indicator, so this only adds the metal bezel, buttons, and the
 * Dynamic Island pill.
 *
 * `maxWidthClass` lets callers size the device for visual hierarchy while
 * every frame keeps the exact 1290/2796 screen aspect ratio, so the phones
 * read as one consistent family and never look stretched.
 */
export default function PhoneFrame({
  src,
  alt,
  priority = false,
  maxWidthClass = "max-w-[300px]",
}: {
  src: string;
  alt: string;
  priority?: boolean;
  maxWidthClass?: string;
}) {
  const buttonGradient =
    "linear-gradient(90deg, #55555a 0%, #303035 25%, #16161a 55%, #303035 80%, #55555a 100%)";

  return (
    <div className={`relative mx-auto w-full ${maxWidthClass}`}>
      {/* Contact shadow — soft and neutral, not a heavy dramatic drop. */}
      <div
        className="absolute -bottom-3 left-1/2 h-5 w-[70%] -translate-x-1/2 rounded-[50%] blur-lg"
        style={{ background: "rgba(10,10,14,0.30)" }}
      />

      {/* Side buttons — rounded, protruding, dark metal. */}
      <div className="absolute -left-[3.5px] top-[100px] h-[30px] w-[4px] rounded-l-[3px] shadow-[-1px_0_1.5px_rgba(0,0,0,0.5)]" style={{ background: buttonGradient }} />
      <div className="absolute -left-[3.5px] top-[148px] h-[52px] w-[4px] rounded-l-[3px] shadow-[-1px_0_1.5px_rgba(0,0,0,0.5)]" style={{ background: buttonGradient }} />
      <div className="absolute -left-[3.5px] top-[208px] h-[52px] w-[4px] rounded-l-[3px] shadow-[-1px_0_1.5px_rgba(0,0,0,0.5)]" style={{ background: buttonGradient }} />
      <div className="absolute -right-[3.5px] top-[165px] h-[72px] w-[4px] rounded-r-[3px] shadow-[1px_0_1.5px_rgba(0,0,0,0.5)]" style={{ background: buttonGradient }} />

      {/* Metal bezel — dark titanium diagonal gradient with brighter facets
          where light catches the curved, polished edge. */}
      <div
        className="relative aspect-[1290/2796] overflow-hidden rounded-[3.1rem] p-[15px]"
        style={{
          background:
            "linear-gradient(160deg, #55555b 0%, #313136 10%, #1b1b1f 22%, #3d3d43 38%, #232327 52%, #48484e 64%, #1c1c20 80%, #37373d 92%, #55555b 100%)",
          boxShadow:
            "0 30px 60px -25px rgba(0,0,0,0.5), 0 10px 20px -12px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.14)",
        }}
      >
        {/* Outer rim highlight, simulating the polished chamfer edge. */}
        <div className="pointer-events-none absolute inset-[1.5px] rounded-[2.95rem] ring-[1.5px] ring-inset ring-white/20" />
        {/* Inner lip — the seam where the bezel meets the glass. */}
        <div className="pointer-events-none absolute inset-[13px] rounded-[2.2rem] ring-1 ring-inset ring-black/60" />

        <div className="relative h-full w-full overflow-hidden rounded-[2.1rem] bg-black">
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 640px) 60vw, 340px"
            className="object-cover"
            priority={priority}
          />
          {/* Glass reflection — soft diagonal light streak over the screen. */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(115deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 10%, rgba(255,255,255,0) 22%, rgba(255,255,255,0) 78%, rgba(255,255,255,0.03) 90%, rgba(255,255,255,0.09) 100%)",
            }}
          />
        </div>

        {/* Dynamic Island — kept to just the pill, since the composited
            screenshots are real device captures: their status bar icons
            already sit flush beside it, and a decorative second cutout
            would overlap that real content. */}
        <div
          className="absolute left-1/2 top-[21px] h-[22px] w-[78px] -translate-x-1/2 rounded-full bg-black"
          style={{ boxShadow: "inset 0 0 2px rgba(255,255,255,0.15)" }}
        />
      </div>
    </div>
  );
}
