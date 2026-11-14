import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { buttonClass, type ButtonClassOptions } from './buttonClass';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonClassOptions {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, fullWidth, className, type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClass({ variant, size, fullWidth, className })} {...props} />;
});
