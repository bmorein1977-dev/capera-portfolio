import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface UserComboboxOption {
  id: string;
  label: string;
  sublabel?: string | null;
}

// Single-select searchable person picker - used for the "Manager" field on the user edit form
// and for jumping to a person on the Org Chart. Options are passed in already-loaded (no fetch of
// its own) since the two callers source people from different endpoints with different privilege
// levels (AdminUsers already has the full user list; the Org Chart uses the lighter-weight
// Compliance Explorer people list).
export function UserCombobox({
  options, value, onChange, placeholder, allowClear, testId,
}: {
  options: UserComboboxOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          data-testid={`button-${testId}`}
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? selected.label : (placeholder || 'Search…')}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 flex-shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by name..." data-testid={`input-${testId}-search`} />
          <CommandList>
            <CommandEmpty>No one found.</CommandEmpty>
            <CommandGroup>
              {allowClear && (
                <CommandItem
                  value="__none__"
                  onSelect={() => { onChange(null); setOpen(false); }}
                  data-testid={`option-${testId}-none`}
                >
                  <Check className={cn('h-4 w-4', value ? 'opacity-0' : 'opacity-100')} />
                  <span className="text-muted-foreground">None</span>
                </CommandItem>
              )}
              {options.map(o => (
                <CommandItem
                  key={o.id}
                  value={`${o.label} ${o.sublabel || ''}`}
                  onSelect={() => { onChange(o.id); setOpen(false); }}
                  data-testid={`option-${testId}-${o.id}`}
                >
                  <Check className={cn('h-4 w-4', value === o.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex flex-col overflow-hidden">
                    <span className="truncate">{o.label}</span>
                    {o.sublabel && <span className="text-xs text-muted-foreground truncate">{o.sublabel}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
