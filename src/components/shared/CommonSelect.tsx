import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface CommonSelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface CommonSelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange: (value: string) => void;
  options: CommonSelectOption[];
  placeholder?: string;
  className?: string;
  contentClassName?: string;
  itemClassName?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export const CommonSelect: React.FC<CommonSelectProps> = ({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder = "Select an option",
  className,
  contentClassName,
  itemClassName,
  disabled = false,
  ariaLabel,
}) => {
  return (
    <Select
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          "w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:border-sky-500 focus:ring-1 focus:ring-sky-500",
          className,
        )}
        aria-label={ariaLabel}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        className={cn(
          "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs rounded-lg shadow-xl z-50",
          contentClassName,
        )}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className={cn("text-xs py-1.5", itemClassName)}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default CommonSelect;
