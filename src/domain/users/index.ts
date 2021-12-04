export const UserLanguage = {
  DEFAULT: "",
  EN_US: "en",
  ES_SV: "es",
} as const

import { InvalidPhoneNumber, InvalidUsername } from "@domain/errors"

export const UsernameRegex = /(?!^(1|3|bc1|lnbc1))^[0-9a-z_]{3,50}$/i

export const checkedToUsername = (username: string): Username | ValidationError => {
  if (!username.match(UsernameRegex)) {
    return new InvalidUsername(username)
  }
  return username as Username
}

// TODO: we could be using https://gitlab.com/catamphetamine/libphonenumber-js#readme
// for a more precise "regex"
const PhoneNumberRegex = /^\+\d{7,14}$/i // FIXME {7,14} to be refined

export const checkedToPhoneNumber = (
  phoneNumber: string,
): PhoneNumber | ValidationError => {
  if (!phoneNumber.match(PhoneNumberRegex)) {
    return new InvalidPhoneNumber(phoneNumber)
  }
  return phoneNumber as PhoneNumber
}

export const isTestAccountPhone = ({
  phone,
  testAccounts,
}: {
  phone: PhoneNumber
  testAccounts: TestAccounts[]
}) => testAccounts.findIndex((item) => item.phone === phone) !== -1

export const isTestAccountPhoneAndCode = ({
  code,
  phone,
  testAccounts,
}: {
  code: PhoneCode
  phone: PhoneNumber
  testAccounts: TestAccounts[]
}) =>
  testAccounts.findIndex((item) => item.phone === phone) !== -1 &&
  testAccounts.filter((item) => item.phone === phone)[0].code.toString() ===
    code.toString()
