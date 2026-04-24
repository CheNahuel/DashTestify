export type PriceAlertFormState = {
  status: "idle" | "error" | "success";
  message: string;
  errors: {
    email?: string;
    targetPrice?: string;
  };
  submittedAlert?: {
    coinId: string;
    coinName: string;
    coinImage: string;
    email: string;
    targetPrice: number;
  };
};

export const initialPriceAlertFormState: PriceAlertFormState = {
  status: "idle",
  message: "",
  errors: {},
};
