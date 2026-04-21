export function HomePage() {
  return (
    <section className="card">
      <h2>Головна</h2>
      <p>
        Цей інтерфейс призначений для адміністратора турнірів: генерація сіток,
        запуск генетичного алгоритму та візуалізація результатів.
      </p>

      <div className="info-grid">
        <article>
          <h3>1. Генерація</h3>
          <p>
            Обери турнір у статусі <code>planned</code> і створи тип сітки:
            Single Elimination або Group Stage.
          </p>
        </article>
        <article>
          <h3>2. Симуляція</h3>
          <p>
            Для турнірів із згенерованими матчами запусти GA з параметрами
            алгоритму та кількості популяцій.
          </p>
        </article>
        <article>
          <h3>3. Візуалізація</h3>
          <p>
            Переглядай playoff bracket і таблиці груп для поточного стану
            турніру.
          </p>
        </article>
      </div>
    </section>
  );
}
