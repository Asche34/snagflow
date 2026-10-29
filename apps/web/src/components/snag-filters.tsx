import Form from 'next/form';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PRIORITY_LABELS, PRIORITY_ORDER, STATUS_LABELS, STATUS_ORDER } from '@/lib/labels';
import { SORT_LABELS, type SnagFilters as Filters } from '@/lib/snag-filters';
import type { Category, Location, Person } from '@/lib/data';

export function SnagFilters({
  projectId,
  filters,
  people,
  locations,
  categories,
}: {
  projectId: string;
  filters: Filters;
  people: Person[];
  locations: Location[];
  categories: Category[];
}) {
  const fieldId = (name: string) => `project-${projectId}-filter-${name}`;
  const allLabels = {
    status: 'All statuses',
    priority: 'All priorities',
    assignee: 'All assignees',
    location: 'All locations',
    category: 'All categories',
    due: 'All due dates',
  };
  const controls = [
    {
      name: 'status',
      label: 'Status',
      options: STATUS_ORDER.map((id) => ({ id, name: STATUS_LABELS[id] })),
    },
    {
      name: 'priority',
      label: 'Priority',
      options: PRIORITY_ORDER.map((id) => ({ id, name: PRIORITY_LABELS[id] })),
    },
    {
      name: 'assignee',
      label: 'Assignee',
      options: [
        { id: 'me', name: 'Assigned to me' },
        { id: 'unassigned', name: 'Unassigned' },
        ...people.map((person) => ({ id: person.id, name: person.full_name })),
      ],
    },
    { name: 'location', label: 'Location', options: locations },
    { name: 'category', label: 'Category', options: categories },
    {
      name: 'due',
      label: 'Due date',
      options: [
        { id: 'overdue', name: 'Overdue · still open' },
        { id: 'today', name: 'Today · still open' },
        { id: 'week', name: 'Next 7 days · still open' },
        { id: 'none', name: 'No due date' },
      ],
    },
  ] as const;
  return (
    <Form action={`/projects/${projectId}`} className="space-y-4" key={JSON.stringify(filters)}>
      <input type="hidden" name="tab" value="snags" />
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 sm:col-span-2 xl:col-span-3">
          <label htmlFor={fieldId('search')} className="mb-1.5 block text-sm font-medium">
            Search snags
          </label>
          <Input
            id={fieldId('search')}
            name="q"
            type="search"
            maxLength={200}
            defaultValue={filters.q}
            placeholder="Search words or #number"
            aria-describedby={fieldId('help')}
          />
          <p id={fieldId('help')} className="mt-1.5 text-xs text-muted-foreground">
            Search titles and descriptions, or enter an exact snag number.
          </p>
        </div>
        <div className="min-w-0">
          <label htmlFor={fieldId('sort')} className="mb-1.5 block text-sm font-medium">
            Sort by
          </label>
          <Select id={fieldId('sort')} name="sort" defaultValue={filters.sort}>
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        {controls.map(({ name, label, options }) => (
          <div key={name} className="min-w-0">
            <label htmlFor={fieldId(name)} className="mb-1.5 block text-sm font-medium">
              {label}
            </label>
            <Select id={fieldId(name)} name={name} defaultValue={filters[name]}>
              <option value="">{allLabels[name]}</option>
              {filters[name] && !options.some((entry) => entry.id === filters[name]) ? (
                <option value={filters[name]}>Unavailable {label.toLowerCase()}</option>
              ) : null}
              {options.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input
            name="mine"
            type="checkbox"
            value="1"
            defaultChecked={filters.mine}
            className="size-4 accent-primary"
          />
          Created by me
        </label>
        <Button type="submit">Apply filters</Button>
        <Button asChild variant="ghost">
          <Link href={`/projects/${projectId}?tab=snags`}>Clear filters</Link>
        </Button>
      </div>
    </Form>
  );
}
