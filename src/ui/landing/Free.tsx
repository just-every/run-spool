import { Band, DrawingCard } from './Band';
export function Free() {
  return <Band id="free" ornaments={['spools2']} title="100% free." body="Open source under the MIT licence. Every feature, on your own computer.">
    <DrawingCard title="MIT License"><p className="inner-box licence-line">Permission is hereby granted, <span className="mark nowrap">free of charge</span></p></DrawingCard>
  </Band>;
}
