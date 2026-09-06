import type { Sf2Payload } from "../../domain/attendance";

function dayNum(date: string): string {
  return String(Number(date.slice(8)));
}

export function Sf2Document({ payload }: { payload: Sf2Payload }) {
  const males = payload.learners.filter((row) => row.sex === "M");
  const females = payload.learners.filter((row) => row.sex === "F");
  const others = payload.learners.filter((row) => row.sex !== "M" && row.sex !== "F");
  const { summary } = payload;

  const renderRows = (rows: typeof payload.learners, label?: string) => (
    <>
      {rows.map((row, index) => (
        <tr key={row.id}>
          <td>{index + 1}</td>
          <td className="sf2-name">{row.name}</td>
          {payload.dates.map((date) => (
            <td key={date} className="sf2-mark">
              {row.marks[date]}
            </td>
          ))}
          <td>{row.absent || ""}</td>
          <td>{row.tardy || ""}</td>
        </tr>
      ))}
      {label && (
        <tr className="sf2-total">
          <td colSpan={2}>{label}</td>
          {payload.dates.map((date) => (
            <td key={date}>
              {label.startsWith("Male")
                ? payload.totals.male[date]
                : label.startsWith("Female")
                  ? payload.totals.female[date]
                  : payload.totals.all[date]}
            </td>
          ))}
          <td />
          <td />
        </tr>
      )}
    </>
  );

  return (
    <div className="sf2-doc">
      <header className="sf2-head">
        <p>Republic of the Philippines</p>
        <p>Department of Education</p>
        <h1>{payload.title}</h1>
      </header>
      <div className="sf2-meta">
        <div>
          <span>School</span>
          <strong>{payload.schoolName || "—"}</strong>
        </div>
        <div>
          <span>School ID</span>
          <strong>{payload.schoolId || "—"}</strong>
        </div>
        <div>
          <span>School Year</span>
          <strong>{payload.schoolYear || "—"}</strong>
        </div>
        <div>
          <span>Report for the month of</span>
          <strong>{payload.monthLabel}</strong>
        </div>
        <div>
          <span>Grade / Section</span>
          <strong>{payload.gradeSection}</strong>
        </div>
        <div>
          <span>District</span>
          <strong>{payload.district || "—"}</strong>
        </div>
        <div>
          <span>Division</span>
          <strong>{payload.division || "—"}</strong>
        </div>
        <div>
          <span>Region</span>
          <strong>{payload.region || "—"}</strong>
        </div>
      </div>

      <div className="table-scroll sf2-table-wrap">
        <table className="sf2-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name (Last, First, M.I.)</th>
              {payload.dates.map((date) => (
                <th key={date}>{dayNum(date)}</th>
              ))}
              <th>ABSENT</th>
              <th>TARDY</th>
            </tr>
          </thead>
          <tbody>
            {renderRows(males, "Male | Total per day")}
            {renderRows(females, "Female | Total per day")}
            {others.length > 0 && renderRows(others)}
            <tr className="sf2-total">
              <td colSpan={2}>Combined | Total per day</td>
              {payload.dates.map((date) => (
                <td key={date}>{payload.totals.all[date]}</td>
              ))}
              <td />
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <section className="sf2-summary">
        <h2>Summary</h2>
        <dl>
          <div>
            <dt>Enrollment (M / F)</dt>
            <dd>
              {summary.enrollmentMale} / {summary.enrollmentFemale}
            </dd>
          </div>
          <div>
            <dt>Late enrollment (M / F)</dt>
            <dd>
              {summary.lateEnrollmentMale} / {summary.lateEnrollmentFemale}
            </dd>
          </div>
          <div>
            <dt>Transferred in (M / F)</dt>
            <dd>
              {summary.transferredInMale} / {summary.transferredInFemale}
            </dd>
          </div>
          <div>
            <dt>Transferred out (M / F)</dt>
            <dd>
              {summary.transferredOutMale} / {summary.transferredOutFemale}
            </dd>
          </div>
          <div>
            <dt>Dropped out (M / F)</dt>
            <dd>
              {summary.dropOutMale} / {summary.dropOutFemale}
            </dd>
          </div>
          <div>
            <dt>Registered as of end of month (M / F)</dt>
            <dd>
              {payload.registeredMale} / {payload.registeredFemale}
            </dd>
          </div>
        </dl>
      </section>

      <footer className="sf2-sign">
        <p>I certify that this is a true and correct report of attendance.</p>
        <div className="sf2-sign-row">
          <div>
            <strong>{payload.adviser || "________________"}</strong>
            <span>Adviser</span>
          </div>
          <div>
            <strong>{payload.schoolHead || "________________"}</strong>
            <span>School Head</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
