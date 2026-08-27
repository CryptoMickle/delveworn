import { activeDeployment } from "./chain-config";

export function activeRandomnessProvider() {
  return activeDeployment.randomness.provider;
}

export function activeRandomnessProviderLabel() {
  return activeDeployment.randomness.providerLabel;
}

export function supportsRandomnessRetry() {
  return activeDeployment.randomness.retrySupported;
}

export function delayedRandomnessTitle() {
  return `WAITING FOR ${activeDeployment.randomness.providerLabel.toUpperCase()}`;
}

export function delayedRandomnessText(retryAvailable: boolean) {
  if (retryAvailable && activeDeployment.randomness.retrySupported) {
    return `${activeDeployment.randomness.providerLabel} has not fulfilled this request within the onchain timeout. You can safely replace it with a fresh randomness request.`;
  }

  return `Your action is submitted. ${activeDeployment.randomness.providerLabel} has not fulfilled the randomness request yet. The result will appear automatically.`;
}
