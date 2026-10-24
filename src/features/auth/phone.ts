import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';
import { env } from '@/config/env';

export type Country = { code: CountryCode; dialCode: string; name: string; flag: string };

/** Matches the backend's OTP_DEFAULT_COUNTRY; override with EXPO_PUBLIC_DEFAULT_PHONE_COUNTRY. */
export const DEFAULT_COUNTRY: CountryCode = (getCountries() as string[]).includes(
  env.defaultPhoneCountry ?? '',
)
  ? (env.defaultPhoneCountry as CountryCode)
  : 'IN';

const flag = (code: string) =>
  String.fromCodePoint(...[...code].map((letter) => 0x1f1a5 + letter.charCodeAt(0)));

function names(): (code: string) => string {
  try {
    const display = new Intl.DisplayNames(['en'], { type: 'region' });
    return (code) => display.of(code) ?? code;
  } catch {
    // Older Hermes builds lack Intl.DisplayNames; the ISO code is still searchable.
    return (code) => code;
  }
}

let cached: Country[] | null = null;
export function countries(): Country[] {
  if (cached) return cached;
  const name = names();
  cached = getCountries()
    .map((code) => ({
      code,
      dialCode: getCountryCallingCode(code),
      name: name(code),
      flag: flag(code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return cached;
}

export const findCountry = (code: CountryCode): Country =>
  countries().find((country) => country.code === code) ?? countries()[0]!;

/** E.164 for a national number in the chosen country, or null when it is not a valid number. */
export function toE164(national: string, country: CountryCode): string | null {
  const parsed = parsePhoneNumberFromString(national.trim(), country);
  return parsed?.isValid() ? parsed.number : null;
}

export function formatPhone(e164?: string): string {
  if (!e164) return '';
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
