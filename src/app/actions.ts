'use server';

import { PriceAlertFormState } from "@/features/crypto/types/priceAlert";

type PriceAlertContext = {
  coinId: string;
  coinName: string;
  currentPrice: number;
};

const parseTargetPrice = (value: FormDataEntryValue | null) => {
  if (typeof value !== "string") {
    return Number.NaN;
  }

  return Number(value.trim());
};

export async function submitPriceAlert(
  context: PriceAlertContext,
  _prevState: PriceAlertFormState,
  formData: FormData
): Promise<PriceAlertFormState> {
  const emailValue = formData.get("email");
  const targetPriceValue = formData.get("targetPrice");

  const email = typeof emailValue === "string" ? emailValue.trim() : "";
  const targetPrice = parseTargetPrice(targetPriceValue);

  const errors: PriceAlertFormState["errors"] = {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
    errors.targetPrice = "Enter a target price greater than zero.";
  } else if (Math.abs(targetPrice - context.currentPrice) < 0.01) {
    errors.targetPrice = "Choose a price meaningfully different from the current value.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      status: "error",
      message: "Fix the highlighted fields and try again.",
      errors,
    };
  }

  await new Promise((resolve) => setTimeout(resolve, 250));

  return {
    status: "success",
    message: `Alert saved for ${context.coinName}. We'll notify ${email} if the price reaches $${targetPrice.toFixed(2)}.`,
    errors: {},
    submittedAlert: {
      coinId: context.coinId,
      coinName: context.coinName,
      email,
      targetPrice,
    },
  };
}
