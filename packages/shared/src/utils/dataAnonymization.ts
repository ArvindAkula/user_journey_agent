export const anonymizeEmail = (email: string): string => {
  const [username, domain] = email.split('@');
  if (username.length <= 2) {
    return `${username[0]}***@${domain}`;
  }
  return `${username.slice(0, 2)}***@${domain}`;
};

export const anonymizeUserId = (userId: string): string => {
  if (userId.length <= 4) {
    return '****';
  }
  return `${userId.slice(0, 2)}***${userId.slice(-2)}`;
};

export const anonymizeIpAddress = (ip: string): string => {
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.***.`;
  }
  return '***.***.***.***.';
};

export const sanitizeUserData = (data: any): any => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sanitized = { ...data };

  // Remove or anonymize sensitive fields
  if (sanitized.email) {
    sanitized.email = anonymizeEmail(sanitized.email);
  }

  if (sanitized.userId) {
    sanitized.userId = anonymizeUserId(sanitized.userId);
  }

  if (sanitized.ipAddress) {
    sanitized.ipAddress = anonymizeIpAddress(sanitized.ipAddress);
  }

  // Remove sensitive fields entirely
  delete sanitized.password;
  delete sanitized.token;
  delete sanitized.apiKey;
  delete sanitized.ssn;
  delete sanitized.creditCard;

  return sanitized;
};