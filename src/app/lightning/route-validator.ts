import { BadAmountForRouteError } from "@domain/errors"

export const RouteValidator = (rawRoute: RawRoute): RouteValidator => {
  const validate = (amount): true | ApplicationError => {
    if (amount !== rawRoute.tokens) return new BadAmountForRouteError()

    return true
  }

  return {
    validate,
  }
}