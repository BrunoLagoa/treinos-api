import { WeekDay } from "../generated/prisma/enums.js";
import { dayjs } from "../lib/dayjs.js";
import { prisma } from "../lib/db.js";

const DATE_FORMAT = "YYYY-MM-DD";

// Índice do dia da semana (0 = domingo), como retornado por dayjs().day().
const WEEK_DAY_BY_INDEX = [
  WeekDay.SUNDAY,
  WeekDay.MONDAY,
  WeekDay.TUESDAY,
  WeekDay.WEDNESDAY,
  WeekDay.THURSDAY,
  WeekDay.FRIDAY,
  WeekDay.SATURDAY,
];

interface InputStats {
  userId: string;
  from: string;
  to: string;
}

interface OutputConsistency {
  workoutDayCompleted: boolean;
  workoutDayStarted: boolean;
}

interface OutputStats {
  workoutStreak: number;
  consistencyByDay: Record<string, OutputConsistency>;
  completedWorkoutsCount: number;
  conclusionRate: number;
  totalTimeInSeconds: number;
}

export class GetStats {
  async execute(stats: InputStats): Promise<OutputStats> {
    const from = dayjs.utc(stats.from).startOf("day");
    const to = dayjs.utc(stats.to).endOf("day");

    const workoutSessions = await prisma.workoutSession.findMany({
      where: {
        workoutDay: {
          workoutPlan: { userId: stats.userId },
        },
        startedAt: {
          gte: from.toDate(),
          lte: to.toDate(),
        },
      },
      select: { startedAt: true, completedAt: true },
    });

    const completedWorkoutSessions = workoutSessions.filter(
      (workoutSession) => workoutSession.completedAt !== null,
    );

    const totalTimeInSeconds = completedWorkoutSessions.reduce(
      (total, workoutSession) =>
        total +
        dayjs(workoutSession.completedAt).diff(
          dayjs(workoutSession.startedAt),
          "second",
        ),
      0,
    );

    const activeWorkoutPlan = await prisma.workoutPlan.findFirst({
      where: {
        userId: stats.userId,
        isActive: true,
      },
      include: {
        workoutDays: {
          select: { weekDay: true },
        },
      },
    });

    return {
      workoutStreak: this.countWorkoutStreak({
        from,
        to,
        completedWorkoutSessions,
        // Sem plano ativo não há dias "não previstos" para pular, então
        // qualquer dia sem conclusão quebra a sequência.
        planWeekDays: activeWorkoutPlan
          ? new Set(
              activeWorkoutPlan.workoutDays.map(
                (workoutDay) => workoutDay.weekDay,
              ),
            )
          : new Set(WEEK_DAY_BY_INDEX),
      }),
      consistencyByDay: this.buildConsistencyByDay(workoutSessions),
      completedWorkoutsCount: completedWorkoutSessions.length,
      conclusionRate: workoutSessions.length
        ? completedWorkoutSessions.length / workoutSessions.length
        : 0,
      totalTimeInSeconds,
    };
  }

  private buildConsistencyByDay(
    workoutSessions: Array<{ startedAt: Date; completedAt: Date | null }>,
  ): Record<string, OutputConsistency> {
    return workoutSessions.reduce<Record<string, OutputConsistency>>(
      (consistencyByDay, workoutSession) => {
        const day = dayjs.utc(workoutSession.startedAt).format(DATE_FORMAT);

        const consistency = consistencyByDay[day] ?? {
          workoutDayCompleted: false,
          workoutDayStarted: false,
        };

        return {
          ...consistencyByDay,
          [day]: {
            workoutDayStarted: true,
            workoutDayCompleted:
              consistency.workoutDayCompleted ||
              workoutSession.completedAt !== null,
          },
        };
      },
      {},
    );
  }

  private countWorkoutStreak({
    from,
    to,
    completedWorkoutSessions,
    planWeekDays,
  }: {
    from: dayjs.Dayjs;
    to: dayjs.Dayjs;
    completedWorkoutSessions: Array<{ startedAt: Date }>;
    planWeekDays: Set<WeekDay>;
  }): number {
    const completedDays = new Set(
      completedWorkoutSessions.map((workoutSession) =>
        dayjs.utc(workoutSession.startedAt).format(DATE_FORMAT),
      ),
    );

    let workoutStreak = 0;
    let cursor = to.startOf("day");

    while (!cursor.isBefore(from, "day")) {
      if (completedDays.has(cursor.format(DATE_FORMAT))) {
        workoutStreak += 1;
        cursor = cursor.subtract(1, "day");
        continue;
      }

      // Dias que o plano ativo não prevê não quebram a sequência, assim como o
      // último dia do período, que ainda pode estar em andamento.
      const isPlannedDay = planWeekDays.has(WEEK_DAY_BY_INDEX[cursor.day()]);
      const isLastDay = cursor.isSame(to, "day");

      if (isPlannedDay && !isLastDay) {
        break;
      }

      cursor = cursor.subtract(1, "day");
    }

    return workoutStreak;
  }
}
