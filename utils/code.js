// backend/utils/code.js
export const generateCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit string
};
