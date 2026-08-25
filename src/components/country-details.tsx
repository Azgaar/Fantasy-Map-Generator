import { Icon } from "@patkepa/kantzen-ui/icons";
import { useEffect, useState } from "react";
import { getWorkspaceMode } from "@/application/workspace-mode";
import type { State } from "@/generators/states-generator";
import { formatPrice, getArea, getAreaUnit, si } from "@/utils";
import { COUNTRY_SELECTION_CHANGE_EVENT, getSelectedCountryId } from "./country-selection";
import { executeLegacyCommand } from "./ui/legacy-command";
import "./country-details.css";

function getSelectedCountry(): State | null {
  const countryId = getSelectedCountryId();
  return countryId === null ? null : pack.states[countryId] || null;
}

function getCountryPopulation(country: State): number {
  return ((country.rural || 0) + (country.urban || 0) * urbanization) * populationRate;
}

function CountryMetric({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="fantasia-country-details__metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CountryDetailsPanel({ country, onClose }: { country: State; onClose: () => void }): React.JSX.Element {
  const capital = pack.burgs[country.capital]?.name || "—";
  const culture = pack.cultures[country.culture]?.name || "—";
  const diplomacy = country.diplomacy?.filter(relation => relation && relation !== "x").length || 0;
  const military = country.military?.length || 0;
  const form = country.formName || country.form || "State";

  return (
    <section aria-label={`${country.fullName || country.name} details`} className="fantasia-country-details">
      <header className="fantasia-country-details__header">
        <div>
          <p>Selected country</p>
          <h2>{country.fullName || country.name}</h2>
        </div>
        <button aria-label="Close country details" className="fantasia-country-details__close" onClick={onClose} type="button">
          <Icon icon="cross" size={15} />
        </button>
      </header>
      <div className="fantasia-country-details__identity">
        <span aria-hidden="true" className="fantasia-country-details__color" style={{ background: country.color || "#697386" }} />
        <div>
          <strong>{form}</strong>
          <span>{culture} culture</span>
        </div>
      </div>
      <dl className="fantasia-country-details__facts">
        <div>
          <dt>Capital</dt>
          <dd>{capital}</dd>
        </div>
        <div>
          <dt>Culture</dt>
          <dd>{culture}</dd>
        </div>
        <div>
          <dt>Sales tax</dt>
          <dd>{Math.round((country.salesTax || 0) * 100)}%</dd>
        </div>
        <div>
          <dt>Poll tax</dt>
          <dd>{formatPrice(country.pollTax || 0)}</dd>
        </div>
      </dl>
      <div className="fantasia-country-details__metrics">
        <CountryMetric label="Population" value={si(getCountryPopulation(country))} />
        <CountryMetric label="Treasury" value={formatPrice(country.treasury || 0)} />
        <CountryMetric label="Land" value={`${si(getArea(country.area || 0))} ${getAreaUnit()}`} />
        <CountryMetric label="Burgs" value={si(country.burgs || 0)} />
        <CountryMetric label="Regiments" value={si(military)} />
        <CountryMetric label="Relations" value={si(diplomacy)} />
      </div>
      <footer className="fantasia-country-details__actions">
        <button onClick={() => executeLegacyCommand("editStatesButton")} type="button">Manage country</button>
        <button onClick={() => executeLegacyCommand("editDiplomacyButton")} type="button">Diplomacy</button>
      </footer>
    </section>
  );
}

export function CountrySelection(): React.JSX.Element | null {
  const [country, setCountry] = useState(getSelectedCountry);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    const updateCountry = () => {
      setCountry(getSelectedCountry());
      setDetailsOpen(getWorkspaceMode() === "view" && getSelectedCountryId() !== null);
    };
    window.addEventListener(COUNTRY_SELECTION_CHANGE_EVENT, updateCountry);
    return () => window.removeEventListener(COUNTRY_SELECTION_CHANGE_EVENT, updateCountry);
  }, []);

  if (!country || country.removed) return null;
  const title = country.fullName || country.name;

  return (
    <div className="fantasia-country-selection">
      <button
        aria-expanded={detailsOpen}
        aria-label={`Selected country: ${title}. Open country details`}
        className="fantasia-country-selection__trigger"
        onClick={() => setDetailsOpen(open => !open)}
        type="button"
      >
        <span aria-hidden="true" className="fantasia-country-selection__color" style={{ background: country.color || "#697386" }} />
        <span className="fantasia-country-selection__content">
          <small>Selected country</small>
          <strong>{title}</strong>
        </span>
        <Icon aria-hidden="true" icon={detailsOpen ? "chevron-up" : "chevron-down"} size={14} />
      </button>
      {detailsOpen ? <CountryDetailsPanel country={country} onClose={() => setDetailsOpen(false)} /> : null}
    </div>
  );
}
