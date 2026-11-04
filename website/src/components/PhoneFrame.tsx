import Image from "next/image";

/** The image defines the display geometry; hardware sits outside it.
 * Captures already include the status bar, Dynamic Island and home indicator.
 */
export default function PhoneFrame({ src, alt, priority = false, maxWidthClass = "max-w-[300px]" }: {
  src: string; alt: string; priority?: boolean; maxWidthClass?: string;
}) {
  return (
    <div className={`phone-device relative mx-auto w-full ${maxWidthClass}`}>
      <span aria-hidden="true" className="phone-button phone-action" />
      <span aria-hidden="true" className="phone-button phone-volume-up" />
      <span aria-hidden="true" className="phone-button phone-volume-down" />
      <span aria-hidden="true" className="phone-button phone-power" />
      <div className="phone-shell">
        <div className="phone-display">
          <Image src={src} alt={alt} width={1320} height={2868}
            sizes="(max-width: 380px) 78vw, (max-width: 640px) 300px, 340px"
            className="block h-auto w-full" preload={priority} quality={90} />
        </div>
      </div>
    </div>
  );
}
