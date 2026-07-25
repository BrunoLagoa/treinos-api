import { NotFoundError } from "../errors/index.js";
import { prisma } from "../lib/db.js";

interface InputUserTrainData {
  userId: string;
}

interface OutputUserTrainData {
  userId: string;
  userName: string;
  weightInGrams: number;
  heightInCentimeters: number;
  age: number;
  bodyFatPercentage: number;
}

export class GetUserTrainData {
  async execute(
    userTrainData: InputUserTrainData,
  ): Promise<OutputUserTrainData | null> {
    const existingUser = await prisma.user.findUnique({
      where: { id: userTrainData.userId },
    });

    if (!existingUser) {
      throw new NotFoundError("User not found.");
    }

    const { weightInGrams, heightInCentimeters, age, bodyFatPercentage } =
      existingUser;

    // Os dados de treino são gravados em conjunto: enquanto qualquer um deles
    // estiver ausente, o usuário ainda não preencheu seus dados.
    if (
      weightInGrams === null ||
      heightInCentimeters === null ||
      age === null ||
      bodyFatPercentage === null
    ) {
      return null;
    }

    return {
      userId: existingUser.id,
      userName: existingUser.name,
      weightInGrams,
      heightInCentimeters,
      age,
      bodyFatPercentage,
    };
  }
}
