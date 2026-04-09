export const oneDecimalRegex = /^\d+(\.\d)?$/;

export function assertOneDecimal(input) {
  const value = typeof input === 'number' ? input.toString() : input;
  return oneDecimalRegex.test(value);
}
