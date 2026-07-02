import type { Metadata } from "next";
import Link from "next/link";
import { updatePortalAccountAction } from "@/app/portal/actions";
import { PortalShell } from "@/components/shells/portal-shell";
import { getPortalContext } from "@/lib/portal-data";
import { neighborhoods } from "@/lib/site";

export const metadata: Metadata = {
  title: "Portal Account",
};

export default async function PortalAccountPage() {
  const context = await getPortalContext("/portal/account");
  const profile = context.auth.status === "ok" ? context.auth.profile : null;
  const primaryAddress =
    context.addresses.find((address) => address.is_primary) ?? context.addresses[0];

  return (
    <PortalShell title="Account settings" auth={context.auth}>
      <section className="placeholder-panel">
        <p className="section-kicker">Account</p>
        <h1>Keep your service details current.</h1>
        <p className="muted">
          Update contact preferences, address notes, gate codes, and the little
          details that make route day go smoothly.
        </p>

        {profile ? (
          <form action={updatePortalAccountAction} className="form-section">
            <input
              type="hidden"
              name="serviceAddressId"
              value={primaryAddress?.id ?? ""}
            />
            <h2>Profile</h2>
            <div className="form-grid">
              <label className="field">
                <span>First name</span>
                <input name="firstName" defaultValue={profile.first_name ?? ""} />
              </label>
              <label className="field">
                <span>Last name</span>
                <input name="lastName" defaultValue={profile.last_name ?? ""} />
              </label>
              <label className="field">
                <span>Phone</span>
                <input name="phone" type="tel" defaultValue={profile.phone ?? ""} />
              </label>
              <label className="field">
                <span>Email</span>
                <input value={profile.email ?? "No email on file"} readOnly />
                <small className="muted">Contact us to change your email.</small>
              </label>
              <label className="field">
                <span>Preferred contact method</span>
                <select
                  name="preferredContactMethod"
                  defaultValue={profile.preferred_contact_method ?? "email"}
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="sms">SMS placeholder</option>
                </select>
              </label>
            </div>
            <div className="choice-grid">
              <label className="choice-card">
                <input
                  type="checkbox"
                  name="marketingOptIn"
                  defaultChecked={profile.marketing_opt_in}
                />
                <span>Send occasional route updates and local offers.</span>
              </label>
              <label className="choice-card">
                <input
                  type="checkbox"
                  name="smsOptIn"
                  defaultChecked={profile.sms_opt_in}
                />
                <span>SMS opt-in placeholder for future text automations.</span>
              </label>
            </div>

            <h2>Primary service address</h2>
            <div className="form-grid">
              <label className="field">
                <span>Street address</span>
                <input
                  name="streetAddress"
                  defaultValue={primaryAddress?.street_address ?? ""}
                />
              </label>
              <label className="field">
                <span>City</span>
                <input name="city" defaultValue={primaryAddress?.city ?? "Summerville"} />
              </label>
              <label className="field">
                <span>State</span>
                <input name="state" defaultValue={primaryAddress?.state ?? "SC"} />
              </label>
              <label className="field">
                <span>ZIP code</span>
                <input name="zipCode" defaultValue={primaryAddress?.zip_code ?? ""} />
              </label>
              <label className="field">
                <span>Neighborhood</span>
                <select
                  name="neighborhood"
                  defaultValue={primaryAddress?.neighborhood ?? "Cane Bay Plantation"}
                >
                  {neighborhoods.map((neighborhood) => (
                    <option value={neighborhood} key={neighborhood}>
                      {neighborhood}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Gate code</span>
                <input name="gateCode" defaultValue={primaryAddress?.gate_code ?? ""} />
              </label>
            </div>
            <label className="field">
              <span>Address notes</span>
              <textarea
                name="addressNotes"
                defaultValue={primaryAddress?.notes ?? ""}
                placeholder="Bin spot, HOA details, gate notes, dog in yard, broken lid, anything helpful"
              />
            </label>

            <div className="action-row">
              <button className="button button-dark" type="submit">
                Save Account
              </button>
              <Link className="button button-outline" href="/reset-password">
                Reset / Change Password
              </Link>
            </div>
          </form>
        ) : (
          <p>Account settings are available after sign-in.</p>
        )}
      </section>
    </PortalShell>
  );
}
