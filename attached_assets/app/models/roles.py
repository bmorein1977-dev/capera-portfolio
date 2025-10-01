from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, UniqueConstraint
from app.db import Base

class JobRole(Base):
    __tablename__ = "job_roles"
    id = Column(Integer, primary_key=True)
    client_id = Column(Integer, index=True, nullable=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=True)
    business_unit = Column(String, nullable=True)
    __table_args__ = (UniqueConstraint("client_id","name", name="uq_client_role"),)

class RoleElement(Base):
    __tablename__ = "role_elements"
    id = Column(Integer, primary_key=True)
    role_id = Column(Integer, ForeignKey("job_roles.id", ondelete="CASCADE"))
    element_id = Column(Integer, ForeignKey("competence_elements.id", ondelete="CASCADE"))
    required = Column(Boolean, default=True)
    __table_args__ = (UniqueConstraint("role_id","element_id", name="uq_role_element"),)
