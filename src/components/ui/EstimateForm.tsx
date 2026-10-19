"use client";

import { CheckCircle2 } from "lucide-react";
import { useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { SERVICE_OPTIONS, site, type ServiceOption } from "@/content/site";
import { cn } from "@/lib/cn";
import { useEstimateIntent } from "@/lib/estimate-intent";
import { formatUSPhone } from "@/lib/forms/phone";
import { validateEstimate, type EstimateErrors, type EstimateValues } from "@/lib/forms/validate";

type Status = "idle" | "submitting" | "done";

const EMPTY: EstimateValues = { name: "", city: "", email: "", phone: "", service: "", message: "" };

const fieldClass =
  "h-12 w-full border border-rule-dark bg-slate-raised px-4 text-[16px] text-on-dark outline-none transition-colors placeholder:text-muted-on-dark/60 focus:border-accent aria-invalid:border-accent-hover";

function Label({ htmlFor, children, required }: { htmlFor: string; children: string; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="eyebrow mb-2 block text-on-dark">
      {children}
      {required && (
        <span aria-hidden className="ml-1 text-accent">
          *
        </span>
      )}
    </label>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-2 text-[13px] text-accent-hover">
      {message}
    </p>
  );
}

export function EstimateForm() {
  const intent = useEstimateIntent();
  const baseId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<EstimateValues>(EMPTY);
  const [errors, setErrors] = useState<EstimateErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [appliedRequestId, setAppliedRequestId] = useState(0);

  // Preselect the service whenever a "Get a … Estimate" link fires (adjusting state during render).
  if (intent.requestId !== appliedRequestId) {
    setAppliedRequestId(intent.requestId);
    if (intent.service) {
      const service: ServiceOption = intent.service;
      const next = { ...values, service };
      setValues(next);
      if (attempted) setErrors(validateEstimate(next));
    }
  }

  const id = (field: keyof EstimateValues) => `${baseId}-${field}`;

  const update =
    (field: keyof EstimateValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const raw = event.target.value;
      const next: EstimateValues = {
        ...values,
        [field]: field === "phone" ? formatUSPhone(raw) : raw,
      };
      setValues(next);
      if (attempted) setErrors(validateEstimate(next));
    };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateEstimate(values);
    setErrors(nextErrors);
    setAttempted(true);
    const firstInvalid = (Object.keys(nextErrors) as Array<keyof EstimateValues>)[0];
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(id(firstInvalid))}`)?.focus();
      return;
    }
    // Prototype: no network call. Show a short loading state, then the success panel.
    setStatus("submitting");
    window.setTimeout(() => setStatus("done"), 600);
  };

  if (status === "done") {
    return (
      <div className="flex min-h-[420px] flex-col justify-center border border-rule-dark bg-slate-raised p-10" role="status" aria-live="polite">
        <CheckCircle2 aria-hidden className="size-10 text-accent" strokeWidth={1.75} />
        <p className="display-lg mt-6">{site.estimate.successTitle}</p>
        <p className="lede mt-4 text-on-dark/85">{site.estimate.successBody}</p>
      </div>
    );
  }

  const invalid = (field: keyof EstimateValues) => Boolean(errors[field]);
  const describedBy = (field: keyof EstimateValues) => (errors[field] ? `${id(field)}-error` : undefined);

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-6 sm:grid-cols-2">
      <div>
        <Label htmlFor={id("name")} required>Name</Label>
        <input id={id("name")} name="name" autoComplete="name" value={values.name} onChange={update("name")} aria-invalid={invalid("name")} aria-describedby={describedBy("name")} className={fieldClass} />
        <FieldError id={`${id("name")}-error`} message={errors.name} />
      </div>
      <div>
        <Label htmlFor={id("city")} required>City</Label>
        <input id={id("city")} name="city" autoComplete="address-level2" value={values.city} onChange={update("city")} aria-invalid={invalid("city")} aria-describedby={describedBy("city")} className={fieldClass} />
        <FieldError id={`${id("city")}-error`} message={errors.city} />
      </div>
      <div>
        <Label htmlFor={id("email")} required>Email</Label>
        <input id={id("email")} name="email" type="email" autoComplete="email" inputMode="email" value={values.email} onChange={update("email")} aria-invalid={invalid("email")} aria-describedby={describedBy("email")} className={fieldClass} />
        <FieldError id={`${id("email")}-error`} message={errors.email} />
      </div>
      <div>
        <Label htmlFor={id("phone")} required>Phone</Label>
        <input id={id("phone")} name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="(586) 555-0123" value={values.phone} onChange={update("phone")} aria-invalid={invalid("phone")} aria-describedby={describedBy("phone")} className={fieldClass} />
        <FieldError id={`${id("phone")}-error`} message={errors.phone} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={id("service")} required>Service Needed</Label>
        <select id={id("service")} name="service" value={values.service} onChange={update("service")} aria-invalid={invalid("service")} aria-describedby={describedBy("service")} className={cn(fieldClass, "appearance-none bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239aa3ae' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:16px_16px] bg-[position:right_1rem_center] bg-no-repeat pr-10", !values.service && "text-muted-on-dark/60")}>
          <option value="" disabled>
            Choose a service
          </option>
          {SERVICE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <FieldError id={`${id("service")}-error`} message={errors.service} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={id("message")}>Message</Label>
        <textarea id={id("message")} name="message" rows={4} value={values.message} onChange={update("message")} className={cn(fieldClass, "h-auto py-3 leading-relaxed")} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={status === "submitting"} className="w-full sm:w-auto">
          {status === "submitting" ? site.estimate.submitting : site.estimate.submit}
        </Button>
      </div>
    </form>
  );
}
