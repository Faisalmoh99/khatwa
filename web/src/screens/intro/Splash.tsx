/** Brand splash shown briefly on a cold start. Respects reduced motion. */
export function Splash() {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-gradient-to-b from-brand-700 to-brand-950 text-white"
      role="status"
      aria-label="خطوة"
      data-testid="splash"
    >
      <div className="grid justify-items-center gap-4">
        <img
          src="/logo.png"
          alt=""
          width={112}
          height={112}
          className="animate-logo-in rounded-lg shadow-lift"
        />
        <p className="animate-fade-up text-3xl font-semibold [animation-delay:250ms]">خطوة</p>
        <p className="animate-fade-up text-base text-brand-100 [animation-delay:400ms]">
          قياس يومي لحرارة القدمين عند الوضوء
        </p>
      </div>
    </div>
  );
}
