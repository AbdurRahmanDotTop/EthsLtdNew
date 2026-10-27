import * as otplibPkg from 'otplib';

export const authenticator = {
  generateSecret: () => {
    return otplibPkg.generateSecret();
  },
  keyuri: (label: string, issuer: string, secret: string) => {
    return otplibPkg.generateURI({ label, issuer, secret });
  },
  verify: ({ token, secret }: { token: string; secret: string }) => {
    try {
      if (!token || !secret) return false;
      const res = otplibPkg.verifySync({ token: String(token).trim(), secret: String(secret).trim() });
      return res?.valid === true;
    } catch {
      return false;
    }
  },
  check: (token: string, secret: string) => {
    try {
      if (!token || !secret) return false;
      const res = otplibPkg.verifySync({ token: String(token).trim(), secret: String(secret).trim() });
      return res?.valid === true;
    } catch {
      return false;
    }
  }
};

export default authenticator;
