import type { ServiceOption } from "@/content/site";
import { isValidUSPhone } from "./phone";

export type EstimateValues = {
  name: string;
  city: string;
  email: string;
  phone: string;
  service: ServiceOption | "";
  message: string;
};

export type EstimateErrors = Partial<Record<keyof EstimateValues, string>>;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const ESTIMATE_MESSAGES = {
  name: "Please enter your name.",
  city: "Please enter your city.",
  email: "Please enter a valid email address.",
  phone: "Please enter a 10-digit phone number.",
  service: "Please choose a service.",
} as const;

export function validateEstimate(values: EstimateValues): EstimateErrors {
  const errors: EstimateErrors = {};
  if (!values.name.trim()) errors.name = ESTIMATE_MESSAGES.name;
  if (!values.city.trim()) errors.city = ESTIMATE_MESSAGES.city;
  if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = ESTIMATE_MESSAGES.email;
  if (!isValidUSPhone(values.phone)) errors.phone = ESTIMATE_MESSAGES.phone;
  if (!values.service) errors.service = ESTIMATE_MESSAGES.service;
  return errors;
}
