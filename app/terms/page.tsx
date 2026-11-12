import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Условия использования | CarCar",
  description: "Правила бесплатного сервиса CarCar.",
  robots: { index: true, follow: true },
};

const EMAIL = process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "privacy@carcar.pl";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 py-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Условия использования</h1>
        <p className="text-sm text-muted-foreground">Обновлено 12 ноября 2026</p>
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Шаблон для закрытой беты. Перед публичным запуском нужна польская
          редакция и юридическая проверка.
        </p>
      </div>

      <Section title="Сервис">
        <p>
          CarCar собирает открытые объявления о продаже автомобилей в Польше,
          показывает их в одном месте, считает оценку рынка и присылает
          уведомления. Сервис бесплатный: платежей, подписок и рекламы внутри
          выдачи нет. CarCar не является стороной сделки и не продаёт автомобили.
        </p>
      </Section>

      <Section title="Данные и точность">
        <p>
          Объявления принадлежат площадкам и продавцам. Мы можем показывать
          устаревшую или неполную информацию; цена, пробег и история требуют
          проверки у продавца. Оценка рынка — статистическая подсказка, а не
          гарантия цены или юридическая консультация.
        </p>
      </Section>

      <Section title="Аккаунт">
        <p>
          Для избранного, шортлиста и алертов нужен аккаунт. Указывайте свои
          данные, не передавайте доступ третьим лицам и не создавайте аккаунты
          автоматическими скриптами. Аккаунт можно удалить в настройках; данные
          удаляются каскадом.
        </p>
      </Section>

      <Section title="Допустимое использование">
        <ul className="list-disc space-y-1 pl-5">
          <li>Нельзя обходить защиту площадок, массово выгружать данные и перепродавать их.</li>
          <li>Нельзя ломать сервис, рассылать спам и выдавать себя за другого человека.</li>
          <li>Нельзя использовать CarCar для нарушения закона или прав третьих лиц.</li>
        </ul>
      </Section>

      <Section title="Интеллектуальная собственность">
        <p>
          Товарные знаки площадок и продавцов принадлежат им. Оформление CarCar,
          тексты и оценки — наши. Ссылки на оригинальные объявления сохраняются.
        </p>
      </Section>

      <Section title="Ответственность">
        <p>
          Сервис предоставляется «как есть». В пределах, разрешённых законом, мы
          не отвечаем за убытки от сделок, действий продавцов, недоступность
          площадок или потерю данных. Это не ограничивает права потребителя,
          которые нельзя ограничить по закону.
        </p>
      </Section>

      <Section title="Изменения и контакты">
        <p>
          Мы можем обновлять условия; актуальная версия — на этой странице.
          Вопросы: <a className="underline" href={`mailto:${EMAIL}`}>{EMAIL}</a>.
          Применимое право — право Польши.
        </p>
      </Section>
    </div>
  );
}
