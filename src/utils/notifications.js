import Notification from "../models/Notification.js";

export async function createNotification({
  userId = null,
  recipientType,
  title,
  message,
  type = "general",
  data = {},
}) {
  if (!recipientType) {
    throw new Error("Notification recipientType is required.");
  }

  if (!["admin", "consumer", "technician"].includes(recipientType)) {
    throw new Error("Invalid notification recipient type.");
  }

  // Consumer and technician notifications must have userId.
  if (
    (recipientType === "consumer" || recipientType === "technician") &&
    !userId
  ) {
    throw new Error(
      `${recipientType} notification requires userId.`
    );
  }

  const notificationData = {
    recipientType,
    title,
    message,
    type,
    data,
    isRead: false,
  };

  // Only add userId for consumer/technician.
  if (userId) {
    notificationData.userId = userId;
  }

  const notification = await Notification.create(notificationData);

  return notification;
}