from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import Rehabilitation
from app.crud import delete_many


def test_delete_many_removes_selected_rehabilitations():
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
                Rehabilitation(
                    pda_number="PDA-3",
                    departement="Atlantique",
                    commune="Abomey-Calavi",
                    arrondissement="Calavi",
                    village="Aga",
                    annee_rehabilitation=2024,
                    superficie_rehabilitee=9,
                ),
            ]
        )
        db.commit()

        first_id = db.query(Rehabilitation.id).order_by(Rehabilitation.id.asc()).first()[0]
        second_id = db.query(Rehabilitation.id).order_by(Rehabilitation.id.asc()).offset(1).first()[0]

        delete_many(db, [first_id, second_id])
        remaining = db.query(Rehabilitation).all()

        assert len(remaining) == 1
        assert remaining[0].pda_number == "PDA-3"
