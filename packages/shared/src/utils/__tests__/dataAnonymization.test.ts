import {
  anonymizeEmail,
  anonymizePhoneNumber,
  anonymizeIPAddress,
  anonymizeUserData,
  hashSensitiveData,
  maskString,
  isValidEmail,
  isValidPhoneNumber,
  generateAnonymousId
} from '../dataAnonymization';

describe('Data Anonymization', () => {
  describe('anonymizeEmail', () => {
    it('anonymizes email addresses', () => {
      expect(anonymizeEmail('john.doe@example.com')).toBe('j***@example.com');
      expect(anonymizeEmail('a@test.com')).toBe('a***@test.com');
      expect(anonymizeEmail('very.long.email@domain.co.uk')).toBe('v***@domain.co.uk');
    });

    it('handles invalid emails', () => {
      expect(anonymizeEmail('invalid-email')).toBe('invalid-email');
      expect(anonymizeEmail('')).toBe('');
      expect(anonymizeEmail('no-at-sign')).toBe('no-at-sign');
    });

    it('preserves domain', () => {
      const anonymized = anonymizeEmail('user@company.com');
      expect(anonymized).toContain('@company.com');
    });
  });

  describe('anonymizePhoneNumber', () => {
    it('anonymizes phone numbers', () => {
      expect(anonymizePhoneNumber('+1-555-123-4567')).toBe('+1-555-***-****');
      expect(anonymizePhoneNumber('555-123-4567')).toBe('555-***-****');
      expect(anonymizePhoneNumber('5551234567')).toBe('555***4567');
    });

    it('handles different formats', () => {
      expect(anonymizePhoneNumber('(555) 123-4567')).toBe('(555) ***-****');
      expect(anonymizePhoneNumber('+44 20 7946 0958')).toBe('+44 20 **** ****');
    });

    it('handles short numbers', () => {
      expect(anonymizePhoneNumber('123')).toBe('***');
      expect(anonymizePhoneNumber('12345')).toBe('12***');
    });

    it('handles invalid phone numbers', () => {
      expect(anonymizePhoneNumber('')).toBe('');
      expect(anonymizePhoneNumber('abc')).toBe('***');
    });
  });

  describe('anonymizeIPAddress', () => {
    it('anonymizes IPv4 addresses', () => {
      expect(anonymizeIPAddress('192.168.1.100')).toBe('192.168.1.***');
      expect(anonymizeIPAddress('10.0.0.1')).toBe('10.0.0.***');
    });

    it('anonymizes IPv6 addresses', () => {
      expect(anonymizeIPAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334'))
        .toBe('2001:0db8:85a3:****:****:****:****:****');
    });

    it('handles localhost', () => {
      expect(anonymizeIPAddress('127.0.0.1')).toBe('127.0.0.***');
      expect(anonymizeIPAddress('::1')).toBe('::***');
    });

    it('handles invalid IP addresses', () => {
      expect(anonymizeIPAddress('invalid-ip')).toBe('invalid-ip');
      expect(anonymizeIPAddress('')).toBe('');
    });
  });

  describe('anonymizeUserData', () => {
    it('anonymizes user data object', () => {
      const userData = {
        id: 'user123',
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '555-123-4567',
        ipAddress: '192.168.1.100',
        address: '123 Main St, City, State',
        age: 30,
        preferences: {
          theme: 'dark',
          notifications: true
        }
      };

      const anonymized = anonymizeUserData(userData);

      expect(anonymized.id).toBe('user123'); // ID preserved
      expect(anonymized.name).toBe('J*** D***');
      expect(anonymized.email).toBe('j***@example.com');
      expect(anonymized.phone).toBe('555-***-****');
      expect(anonymized.ipAddress).toBe('192.168.1.***');
      expect(anonymized.address).toBe('*** Main St, City, State');
      expect(anonymized.age).toBe(30); // Age preserved
      expect(anonymized.preferences).toEqual(userData.preferences); // Nested objects preserved
    });

    it('handles missing fields', () => {
      const userData = {
        id: 'user123',
        name: 'John Doe'
      };

      const anonymized = anonymizeUserData(userData);

      expect(anonymized.id).toBe('user123');
      expect(anonymized.name).toBe('J*** D***');
      expect(anonymized.email).toBeUndefined();
    });

    it('handles null and undefined values', () => {
      const userData = {
        id: 'user123',
        name: null,
        email: undefined,
        phone: ''
      };

      const anonymized = anonymizeUserData(userData);

      expect(anonymized.id).toBe('user123');
      expect(anonymized.name).toBeNull();
      expect(anonymized.email).toBeUndefined();
      expect(anonymized.phone).toBe('');
    });
  });

  describe('hashSensitiveData', () => {
    it('hashes sensitive data consistently', () => {
      const data = 'sensitive-information';
      const hash1 = hashSensitiveData(data);
      const hash2 = hashSensitiveData(data);
      
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(data);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 character hex string
    });

    it('produces different hashes for different data', () => {
      const hash1 = hashSensitiveData('data1');
      const hash2 = hashSensitiveData('data2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('handles empty strings', () => {
      const hash = hashSensitiveData('');
      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
    });

    it('handles special characters', () => {
      const hash = hashSensitiveData('special!@#$%^&*()');
      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
    });
  });

  describe('maskString', () => {
    it('masks string with default character', () => {
      expect(maskString('password', 2, 2)).toBe('pa****rd');
      expect(maskString('secret', 1, 1)).toBe('s****t');
    });

    it('masks string with custom character', () => {
      expect(maskString('password', 2, 2, '#')).toBe('pa####rd');
      expect(maskString('secret', 1, 1, 'X')).toBe('sXXXXt');
    });

    it('handles short strings', () => {
      expect(maskString('ab', 1, 1)).toBe('a*b');
      expect(maskString('a', 0, 0)).toBe('*');
      expect(maskString('', 0, 0)).toBe('');
    });

    it('handles edge cases', () => {
      expect(maskString('test', 10, 10)).toBe('test'); // More chars to keep than string length
      expect(maskString('test', 0, 0)).toBe('****');
      expect(maskString('test', 2, 0)).toBe('te**');
      expect(maskString('test', 0, 2)).toBe('**st');
    });
  });

  describe('isValidEmail', () => {
    it('validates correct email addresses', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('test.email@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
    });

    it('rejects invalid email addresses', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('@domain.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('user space@domain.com')).toBe(false);
    });
  });

  describe('isValidPhoneNumber', () => {
    it('validates correct phone numbers', () => {
      expect(isValidPhoneNumber('+1-555-123-4567')).toBe(true);
      expect(isValidPhoneNumber('555-123-4567')).toBe(true);
      expect(isValidPhoneNumber('(555) 123-4567')).toBe(true);
      expect(isValidPhoneNumber('5551234567')).toBe(true);
    });

    it('rejects invalid phone numbers', () => {
      expect(isValidPhoneNumber('123')).toBe(false); // Too short
      expect(isValidPhoneNumber('abc-def-ghij')).toBe(false); // Letters
      expect(isValidPhoneNumber('')).toBe(false);
      expect(isValidPhoneNumber('123-45')).toBe(false); // Too short
    });
  });

  describe('generateAnonymousId', () => {
    it('generates unique anonymous IDs', () => {
      const id1 = generateAnonymousId();
      const id2 = generateAnonymousId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^anon_[a-f0-9]{8}$/);
      expect(id2).toMatch(/^anon_[a-f0-9]{8}$/);
    });

    it('generates consistent IDs for same input', () => {
      const input = 'user123';
      const id1 = generateAnonymousId(input);
      const id2 = generateAnonymousId(input);
      
      expect(id1).toBe(id2);
      expect(id1).toMatch(/^anon_[a-f0-9]{8}$/);
    });

    it('generates different IDs for different inputs', () => {
      const id1 = generateAnonymousId('user1');
      const id2 = generateAnonymousId('user2');
      
      expect(id1).not.toBe(id2);
    });
  });

  describe('integration tests', () => {
    it('anonymizes complete user profile', () => {
      const userProfile = {
        id: 'user_12345',
        email: 'john.smith@company.com',
        phone: '+1-555-987-6543',
        name: 'John Smith',
        ipAddress: '203.0.113.42',
        address: '456 Oak Avenue, Springfield, IL',
        creditCard: '4532-1234-5678-9012',
        ssn: '123-45-6789'
      };

      const anonymized = anonymizeUserData(userProfile);

      // Verify all sensitive data is anonymized
      expect(anonymized.email).not.toBe(userProfile.email);
      expect(anonymized.phone).not.toBe(userProfile.phone);
      expect(anonymized.name).not.toBe(userProfile.name);
      expect(anonymized.ipAddress).not.toBe(userProfile.ipAddress);
      expect(anonymized.address).not.toBe(userProfile.address);

      // Verify structure is preserved
      expect(Object.keys(anonymized)).toEqual(Object.keys(userProfile));
      
      // Verify ID is preserved for tracking
      expect(anonymized.id).toBe(userProfile.id);
    });

    it('handles batch anonymization', () => {
      const users = [
        { id: '1', email: 'user1@test.com', name: 'User One' },
        { id: '2', email: 'user2@test.com', name: 'User Two' },
        { id: '3', email: 'user3@test.com', name: 'User Three' }
      ];

      const anonymizedUsers = users.map(user => anonymizeUserData(user));

      // Verify all users are anonymized
      anonymizedUsers.forEach((user, index) => {
        expect(user.id).toBe(users[index].id);
        expect(user.email).not.toBe(users[index].email);
        expect(user.name).not.toBe(users[index].name);
      });

      // Verify each user has different anonymized data
      const emails = anonymizedUsers.map(u => u.email);
      const names = anonymizedUsers.map(u => u.name);
      expect(new Set(emails).size).toBe(3);
      expect(new Set(names).size).toBe(3);
    });
  });
});