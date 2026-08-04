function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidMobileNumber(value) {
  return /^\+?[0-9]{10,}$/.test(value.replace(/\s/g, ""));
}

function isValidPinCode(value) {
  return /^[0-9]{6}$/.test(value);
}

function isValidCoordinate(value, min, max) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return false;
  }

  return numericValue >= min && numericValue <= max;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildConsumerNo(value) {
  const normalizedValue = normalizeString(value);

  if (normalizedValue) {
    return normalizedValue;
  }

  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeGrowCleaningPayload(payload = {}) {
  const consumerNumber = normalizeString(payload.consumerNumber);

  return {
    fullName: normalizeString(payload.fullName),
    mobileNumber: normalizeString(payload.mobileNumber),
    email: normalizeString(payload.email).toLowerCase(),
    address: normalizeString(payload.address),
    city: normalizeString(payload.city),
    state: normalizeString(payload.state),
    pinCode: normalizeString(payload.pinCode),
    agreedToTerms: Boolean(payload.agreedToTerms),
    latitude: normalizeString(payload.latitude),
    longitude: normalizeString(payload.longitude),
    locationAddress: normalizeString(payload.locationAddress),
    sitePhotoBase64: normalizeString(payload.sitePhotoBase64),
    paymentMethod: normalizeString(payload.paymentMethod || "pending"),
    transactionId: normalizeString(payload.transactionId),
    numberOfPanels: Number(payload.numberOfPanels) || 1,
    sprinkler: Boolean(payload.sprinkler),
    walkwayAndLadder: Boolean(payload.walkwayAndLadder),
    consumerNumber,
    consumerNo: buildConsumerNo(consumerNumber),
    landmark: normalizeString(payload.landmark),
  };
}

export function validateGrowCleaningPayload(payload = {}) {
  const data = normalizeGrowCleaningPayload(payload);
  const errors = {};

  if (!data.fullName) {
    errors.fullName = "Full name is required.";
  }

  if (!data.mobileNumber) {
    errors.mobileNumber = "Mobile number is required.";
  } else if (!isValidMobileNumber(data.mobileNumber)) {
    errors.mobileNumber = "Enter a valid mobile number.";
  }

  if (!data.email) {
    errors.email = "Email is required.";
  } else if (!isValidEmail(data.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!data.address) {
    errors.address = "Address is required.";
  }

  if (!data.city) {
    errors.city = "City is required.";
  }

  if (!data.agreedToTerms) {
    errors.agreedToTerms = "Terms must be accepted.";
  }

  if (!data.latitude) {
    errors.latitude = "Latitude is required.";
  } else if (!isValidCoordinate(data.latitude, -90, 90)) {
    errors.latitude = "Latitude must be between -90 and 90.";
  }

  if (!data.longitude) {
    errors.longitude = "Longitude is required.";
  } else if (!isValidCoordinate(data.longitude, -180, 180)) {
    errors.longitude = "Longitude must be between -180 and 180.";
  }

  if (
    !Number.isInteger(data.numberOfPanels) ||
    data.numberOfPanels < 1 ||
    data.numberOfPanels > 100
  ) {
    errors.numberOfPanels = "Select a valid number of panels.";
  }

  return {
    data,
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}
