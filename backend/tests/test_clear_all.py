from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import Rehabilitation
from app.crud import clear_all


def test_clear_all_removes_every_rehabilitation():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)

    with Session() as db:
        db.add_all(
            [
                Rehabilitation(
                    pda_number="PDA-1",
                    departement="Atlantique",
                    commune="Abomey-Calavi",
                    arrondissement="Calavi",
                    village="Aga",
                    annee_rehabilitation=2024,
                    superficie_rehabilitee=5,
                ),
                Rehabilitation(
                    pda_number="PDA-2",
                    departement="Atlantique",
                    commune="Abomey-Calavi",
                    arrondissement="Calavi",
                    village="Aga",
                    annee_rehabilitation=2024,
                    superficie_rehabilitee=7,
                ),
            ]
        )
        db.commit()

        deleted = clear_all(db)

        assert deleted == 2
        assert db.query(Rehabilitation).count() == 0
