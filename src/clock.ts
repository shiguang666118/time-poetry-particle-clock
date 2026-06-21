export interface ClockHandAngles {
  hourAngle: number;
  minuteAngle: number;
  secondAngle: number;
}

export function getClockHandAngles(now: Date, offsetSeconds = 0): ClockHandAngles {
  const hours = now.getHours() % 12;
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const millis = now.getMilliseconds();

  const smoothSeconds = seconds + millis / 1000 + offsetSeconds;
  const smoothMinutes = minutes + smoothSeconds / 60;
  const smoothHours = hours + smoothMinutes / 60;

  return {
    hourAngle: -(smoothHours / 12) * Math.PI * 2,
    minuteAngle: -(smoothMinutes / 60) * Math.PI * 2,
    secondAngle: -(smoothSeconds / 60) * Math.PI * 2
  };
}
