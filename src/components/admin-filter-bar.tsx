type FilterOption = {
  label: string;
  value: string;
};

type SelectFilter = {
  name: string;
  label: string;
  value?: string;
  options: FilterOption[];
};

type AdminFilterBarProps = {
  searchValue?: string;
  searchPlaceholder: string;
  selects: SelectFilter[];
  resultCount: number;
  resetHref: string;
};

export function AdminFilterBar({
  searchValue = "",
  searchPlaceholder,
  selects,
  resultCount,
  resetHref,
}: AdminFilterBarProps) {
  return (
    <form className="filter-bar">
      <label className="field filter-search">
        <span>Search</span>
        <input
          name="q"
          defaultValue={searchValue}
          placeholder={searchPlaceholder}
        />
      </label>
      {selects.map((select) => (
        <label className="field" key={select.name}>
          <span>{select.label}</span>
          <select name={select.name} defaultValue={select.value ?? ""}>
            {select.options.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <div className="filter-actions">
        <button className="button button-dark" type="submit">
          Apply
        </button>
        <a className="button button-outline" href={resetHref}>
          Reset
        </a>
        <span className="result-count">{resultCount} shown</span>
      </div>
    </form>
  );
}
