import './Hero.css'

export function Hero({ isMobile }: { isMobile: boolean }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-main">
        <p className="hero-eyebrow mono-label">
          {isMobile ? (
            <>
              AI Engineering &amp; Career Accelerator
              <br />
              by Mohammad Kabajah
            </>
          ) : (
            <>AI Engineering &amp; Career Accelerator — by Mohammad Kabajah</>
          )}
        </p>
        <h1 id="hero-title" className="hero-title">
          Everyone’s corner
          <br />
          of <span className="hero-accent">the internet.</span>
        </h1>
      </div>
    </section>
  )
}
