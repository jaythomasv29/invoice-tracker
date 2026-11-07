import media from "@/content/media.json";

export default function LaunchFilm() {
  return (
    <section aria-labelledby="film-title" className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-24">
      <div className="mb-8 text-center">
        <p className="feature-eyebrow text-xs font-bold uppercase tracking-[0.16em] text-brand-dark">The Sift launch film</p>
        <h2 id="film-title" className="mt-4 text-balance text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">See Sift in action.</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted">A {Math.round(media.film.durationSeconds)}-second introduction to the Business workspace, from supplier invoices to a clearer view of your kitchen.</p>
      </div>
      <figure id="film" className="scroll-mt-24">
        <div className="overflow-hidden rounded-2xl border border-border bg-brand-dark shadow-xl shadow-black/10 sm:rounded-3xl">
          <video controls playsInline preload="none" poster={media.film.poster} width={1920} height={1080}
            aria-label="Sift launch film" aria-describedby="film-caption" className="block aspect-video h-auto w-full">
            <source src={media.film.src} type="video/mp4" />
            <track kind="captions" src={media.film.captions} srcLang="en" label="English" />
            Your browser does not support embedded video. <a href={media.film.src}>Watch the Sift film</a>.
          </video>
        </div>
        <figcaption id="film-caption" className="mt-4 text-center text-sm leading-relaxed text-muted">Business workspace preview · fictional sample data. Price alerts and recipe costing are Business Pro features.</figcaption>
      </figure>
      <details className="mx-auto mt-5 max-w-2xl rounded-2xl border border-border px-5">
        <summary className="cursor-pointer py-3 text-sm font-semibold">Read the film description</summary>
        <div className="space-y-3 pb-5 text-sm leading-relaxed text-muted">
          <p>The film opens with a gradually rising cost line: “Food costs rarely jump. They creep.” Instrumental music accompanies the walkthrough.</p>
          <p>The walkthrough starts with Business Pro price alerts, grouped by product and dated by delivery. A supplier invoice that Sift has just read is then reviewed line by line, with one quantity flagged for a quick check before saving. It continues with the week’s spending by supplier, Business Pro recipe ingredient costs, a search of the invoice library, and a week of spending compared across suppliers.</p>
          <p>All amounts and restaurant records shown are fictional examples. The film closes with Sift’s icon, “Coming to iPhone,” and siftcosts.com.</p>
        </div>
      </details>
    </section>
  );
}
